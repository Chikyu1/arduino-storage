// 소문자 (아두이노와 동일하게 입력)
const SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214"; 
const WRITE_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214"; 
let writeChar, statusP, connectBtn;
let send1Btn, send2Btn, send3Btn;
let circleColor = [255, 255, 255]; // 기본 색상 (흰색)

// 가속도 센서 관련 변수
let accelBtn, accelStatusP, accelTextP;
let accelX = 0, accelY = 0, accelZ = 0;
let accelEnabled = false;
let ballX, ballY; // 원의 위치
let ballVx = 0, ballVy = 0; // 원의 속도
let rotation = 0; // 원의 회전 각도

function setup() {
  createCanvas(windowWidth, windowHeight);

  // BLE 연결
  connectBtn = createButton("Scan & Connect");
  connectBtn.mousePressed(connectAny);
  connectBtn.size(120, 30);
  connectBtn.position(20, 40);

  statusP = createP("Status: Not connected");
  statusP.position(22, 60);

  // SEND 버튼들 추가
  send1Btn = createButton("SEND1");
  send1Btn.mousePressed(() => handleButtonClick(1, [255, 0, 0])); // 빨간색
  send1Btn.size(100, 30);
  send1Btn.position(20, 100);

  send2Btn = createButton("SEND2");
  send2Btn.mousePressed(() => handleButtonClick(2, [0, 255, 0])); // 초록색
  send2Btn.size(100, 30);
  send2Btn.position(130, 100);

  send3Btn = createButton("SEND3");
  send3Btn.mousePressed(() => handleButtonClick(3, [0, 0, 255])); // 파란색
  send3Btn.size(100, 30);
  send3Btn.position(240, 100);

  // 가속도 센서 활성화 버튼
  accelBtn = createButton("Enable Accelerometer");
  accelBtn.mousePressed(enableAccelerometer);
  accelBtn.size(150, 30);
  accelBtn.position(20, 140);

  accelStatusP = createP("Accelerometer: Not enabled");
  accelStatusP.position(22, 170);

  accelTextP = createP("Accel: X: 0, Y: 0, Z: 0");
  accelTextP.position(22, 190);

  // 원의 초기 위치 (화면 중앙)
  ballX = width / 2;
  ballY = height / 2;
}

function draw() {
  background(220);
  
  // 기존 큰 원 그리기 (색상 변경용)
  fill(circleColor[0], circleColor[1], circleColor[2]);
  noStroke();
  circle(width / 2, height / 2, 200);

  // 가속도로 굴러다니는 작은 파란색 원
  if (accelEnabled) {
    updateBallPosition();
    drawRollingBall();
  } else {
    // 비활성화 상태일 때는 중앙에 고정
    ballX = width / 2;
    ballY = height / 2;
    drawRollingBall();
  }
}

// 원의 위치 업데이트 (가속도 기반)
function updateBallPosition() {
  // 가속도를 속도 변화로 변환 (민감도 조절)
  const sensitivity = 0.5;
  ballVx += accelX * sensitivity;
  ballVy += accelY * sensitivity;
  
  // 마찰 적용
  ballVx *= 0.95;
  ballVy *= 0.95;
  
  // 위치 업데이트
  ballX += ballVx;
  ballY += ballVy;
  
  // 경계 충돌 처리
  const radius = 10;
  if (ballX < radius) {
    ballX = radius;
    ballVx *= -0.8; // 반발
  }
  if (ballX > width - radius) {
    ballX = width - radius;
    ballVx *= -0.8;
  }
  if (ballY < radius) {
    ballY = radius;
    ballVy *= -0.8;
  }
  if (ballY > height - radius) {
    ballY = height - radius;
    ballVy *= -0.8;
  }
  
  // 회전 각도 업데이트 (속도에 따라)
  const speed = sqrt(ballVx * ballVx + ballVy * ballVy);
  rotation += speed * 0.1;
}

// 굴러다니는 원 그리기
function drawRollingBall() {
  push();
  translate(ballX, ballY);
  rotate(rotation);
  
  fill(0, 0, 255); // 파란색
  noStroke();
  circle(0, 0, 20);
  
  // 원의 방향 표시를 위한 작은 선
  stroke(255);
  strokeWeight(2);
  line(0, 0, 8, 0);
  
  pop();
}

// ---- BLE Connect ----
async function connectAny() {
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [SERVICE_UUID],
    });
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    writeChar = await service.getCharacteristic(WRITE_UUID);
    statusP.html("Status: Connected to " + (device.name || "device"));
  } catch (e) {
    statusP.html("Status: Error - " + e);
    console.error(e);
  }
}

// ---- Write 1 byte to BLE ----
async function sendNumber(n) {
  if (!writeChar) {
    statusP.html("Status: Not connected");
    return;
  }
  try {
    await writeChar.writeValue(new Uint8Array([n & 0xff]));
    statusP.html("Status: Sent " + n);
  } catch (e) {
    statusP.html("Status: Write error - " + e);
  }
}

// ---- 버튼 클릭 핸들러 ----
async function handleButtonClick(number, color) {
  // 블루투스로 숫자 전송
  await sendNumber(number);
  // 원 색상 변경
  circleColor = color;
}

// ---- 가속도 센서 활성화 ----
function enableAccelerometer() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    // iOS 13+ 권한 요청
    DeviceMotionEvent.requestPermission()
      .then(response => {
        if (response == 'granted') {
          startAccelerometer();
        } else {
          accelStatusP.html("Accelerometer: Permission denied");
          accelEnabled = false;
        }
      })
      .catch(console.error);
  } else {
    // Android 또는 구형 iOS
    startAccelerometer();
  }
}

function startAccelerometer() {
  accelEnabled = true;
  accelStatusP.html("Accelerometer: Enabled");
  
  // DeviceMotionEvent 리스너
  window.addEventListener('devicemotion', handleMotionEvent);
}

function handleMotionEvent(event) {
  if (event.accelerationIncludingGravity) {
    accelX = event.accelerationIncludingGravity.x || 0;
    accelY = event.accelerationIncludingGravity.y || 0;
    accelZ = event.accelerationIncludingGravity.z || 0;
    
    // 텍스트 업데이트
    accelTextP.html(
      `Accel: X: ${accelX.toFixed(2)}, Y: ${accelY.toFixed(2)}, Z: ${accelZ.toFixed(2)}`
    );
  }
}

// 화면 크기 변경 시 원 위치 조정
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (!accelEnabled) {
    ballX = width / 2;
    ballY = height / 2;
  }
}
