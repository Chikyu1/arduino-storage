// 소문자 (아두이노와 동일하게 입력)
const SERVICE_UUID = "19b10000-e8f2-537e-4f6c-d104768a1214"; 
const WRITE_UUID = "19b10001-e8f2-537e-4f6c-d104768a1214"; 
let writeChar, statusP, connectBtn;
let send1Btn, send2Btn, send3Btn;
let circleColor = [255, 255, 255]; // 기본 색상 (흰색)

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
}

function draw() {
  background(220);
  // 원 그리기 (화면 중앙)
  fill(circleColor[0], circleColor[1], circleColor[2]);
  noStroke();
  circle(width / 2, height / 2, 200);
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
