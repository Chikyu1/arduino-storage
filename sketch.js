// 아두이노 피에조 센서 데이터 저장
let intensity = 0; // 0: 없음, 1: 세기1, 2: 세기2, 3: 세기3
let intensityHistory = []; // 세기 히스토리 (저장용)
let circleRadius = 100;
let port = null; // 시리얼 포트
let reader = null; // 시리얼 리더
let connectBtn, statusP;
// 5초 간격으로 최대 3번 거칠기 값 중첩 저장
let roughnessLayers = []; // 각 캡처의 거칠기값 저장 (예: [15, 30, 15])
let capturesDone = 0;     // 완료된 캡처 수 (최대 3)
let captureReady = true;  // 현재 캡처를 받아도 되는지 여부
let nextCaptureTime = 0;  // 다음 캡처 가능 시각 (ms)
// 정적인 스트로크 형상 저장 (각 캡처마다 한 개 형상)
let strokeLayers = [];    // [{ points: [{x,y},...], roughness: number }]
// 색칠 단계 관리
let coloringPhase = 0;    // 0~3 (0: 없음, 1: 33%, 2: 66%, 3: 100%)
let coloringReady = true; // 다음 색칠 신호를 받아도 되는지
let nextColoringTime = 0; // 다음 색칠 가능 시각 (ms)
// 전송/갤러리 모드와 버튼, 전송된 원 데이터
let mode = 'capture';     // 'capture' | 'gallery'
let sendBtn = null;
let resetBtn = null;
let sentCircles = [];     // [{ points: [...], pos: {x,y} }]

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // 시리얼 연결 버튼
  connectBtn = createButton("아두이노 연결");
  connectBtn.mousePressed(connectSerial);
  connectBtn.size(150, 40);
  connectBtn.position(20, 20);
  connectBtn.style('font-size', '16px');
  
  // 상태 표시
  statusP = createP("상태: 연결 안됨");
  statusP.position(22, 70);
  statusP.style('font-size', '14px');
  statusP.style('color', '#666');
}

function draw() {
  background(255);
  
  if (mode === 'capture') {
    // 화면 중앙에 원 그리기
    push();
    translate(width / 2, height / 2);
    
    // 현재까지 캡처된 정적 스트로크 레이어를 중첩해서 그리기
    // 아무 것도 없으면 기본 원을 부드럽게 표시
    if (strokeLayers.length === 0) {
      stroke(0);
      strokeWeight(2);
      noFill();
      circle(0, 0, circleRadius * 2);
    } else {
      // 레이어 수에 따른 오퍼시티 단계 (33%, 66%, 100%)
      noFill();
      const alphaSteps = [85, 170, 255];
      for (let i = 0; i < strokeLayers.length; i++) {
        let alpha = alphaSteps[Math.min(i, alphaSteps.length - 1)];
        stroke(0, alpha);
        strokeWeight(2);
        drawStaticShape(strokeLayers[i].points);
      }
      // 3회 캡처 이후 색칠 단계가 있다면 내부를 빨강으로 채움
      if (capturesDone >= 3 && coloringPhase > 0) {
        const fillAlpha = alphaSteps[Math.min(coloringPhase - 1, alphaSteps.length - 1)];
        fill(255, 0, 0, fillAlpha);
        noStroke();
        const fillPoints = getAveragedShapePoints();
        if (fillPoints && fillPoints.length > 2) {
          beginShape();
          for (let p of fillPoints) {
            vertex(p.x, p.y);
          }
          endShape(CLOSE);
        }
        // 윤곽선은 최근 레이어로 다시 그려 강조
        stroke(0, 200);
        noFill();
        drawStaticShape(strokeLayers[strokeLayers.length - 1].points);
      }
    }
    
    // 세기 값 표시
    fill(0);
    noStroke();
    textAlign(CENTER);
    textSize(20);
    
    // 진행 상태 안내
    fill(30);
    text(`캡처 진행: ${capturesDone}/3`, 0, circleRadius + 50);
    if (capturesDone < 3) {
      if (captureReady) {
        textSize(16);
        fill(80);
        text('세기2 또는 세기3 신호가 감지되면 캡처됩니다', 0, circleRadius + 75);
      } else {
        let remainMs = max(0, nextCaptureTime - millis());
        let remainSec = ceil(remainMs / 1000);
        textSize(16);
        fill(80);
        text(`다음 캡처까지 ${remainSec}초`, 0, circleRadius + 75);
      }
    } else {
      textSize(16);
      fill(80);
      text('3회 캡처 완료', 0, circleRadius + 75);
      if (!coloringReady) {
        let remainMs = Math.max(0, nextColoringTime - millis());
        let remainSec = ceil(remainMs / 1000);
        text(`다음 색칠까지 ${remainSec}초`, 0, circleRadius + 95);
      } else if (coloringPhase < 3) {
        text('coloring 신호를 보내면 빨강으로 채워집니다', 0, circleRadius + 95);
      } else {
        text('색칠 3단계 완료', 0, circleRadius + 95);
        ensureSendButton();
      }
    }
    
    if (intensity === 0) {
      textSize(14);
      fill(150);
      text('아두이노를 연결하고 피에조 센서를 두드려보세요', 0, circleRadius + 95);
    }
    
    pop();
  } else if (mode === 'gallery') {
    // 전송된 원들을 윈도우 내에 표시
    background(245);
    noFill();
    for (let item of sentCircles) {
      push();
      translate(item.pos.x, item.pos.y);
      // 회색 윤곽선
      stroke(0, 200);
      strokeWeight(2);
      drawStaticShape(item.points);
      // 빨간색 내부 (완전 채움)
      fill(255, 0, 0, 255);
      noStroke();
      beginShape();
      for (let p of item.points) {
        vertex(p.x, p.y);
      }
      endShape(CLOSE);
      pop();
    }
    // 안내 문구
    noStroke();
    fill(50);
    textAlign(LEFT, TOP);
    textSize(16);
    text('전송된 원은 여기에 기록됩니다. "다시 그리기"를 눌러 새로 캡처하세요.', 20, 20);
    ensureResetButton();
  }
}

// Web Serial API를 사용하여 아두이노 연결
async function connectSerial() {
  try {
    // 브라우저가 Web Serial API를 지원하는지 확인
    if (!('serial' in navigator)) {
      statusP.html('상태: 브라우저가 Web Serial API를 지원하지 않습니다. Chrome 또는 Edge를 사용해주세요.');
      statusP.style('color', '#f00');
      return;
    }
    
    // 시리얼 포트 요청 (9600 baud rate)
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    
    statusP.html('상태: 연결됨 - 데이터 수신 대기 중...');
    statusP.style('color', '#0a0');
    
    // 데이터 읽기 시작
    readSerialData();
    
  } catch (error) {
    statusP.html('상태: 연결 실패 - ' + error.message);
    statusP.style('color', '#f00');
    console.error('연결 오류:', error);
  }
}

// 시리얼 데이터 읽기
async function readSerialData() {
  const textDecoder = new TextDecoder();
  let buffer = '';
  
  try {
    while (port.readable) {
      reader = port.readable.getReader();
      
      try {
        while (true) {
          const { value, done } = await reader.read();
          
          if (done) {
            break;
          }
          
          // 받은 데이터를 텍스트로 디코딩
          buffer += textDecoder.decode(value, { stream: true });
          
          // 줄바꿈 문자로 메시지 분리
          let lines = buffer.split('\n');
          buffer = lines.pop(); // 마지막 불완전한 줄은 버퍼에 유지
          
          // 각 줄 처리
          for (let line of lines) {
            line = line.trim();
            if (line) {
              processArduinoData(line);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  } catch (error) {
    statusP.html('상태: 읽기 오류 - ' + error.message);
    statusP.style('color', '#f00');
    console.error('읽기 오류:', error);
  }
}

// 아두이노에서 받은 데이터 처리
function processArduinoData(data) {
  // 데이터를 trim하여 공백 제거
  data = data.trim();
  
  // "세기1", "세기2", "세기3" 메시지 파싱
  let newIntensity = 0;
  if (data.includes('세기3')) {
    newIntensity = 3;
    statusP.html('상태: 연결됨 - 세기3 감지');
  } else if (data.includes('세기2')) {
    newIntensity = 2;
    statusP.html('상태: 연결됨 - 세기2 감지');
  } else if (data.includes('세기1')) {
    newIntensity = 1;
    statusP.html('상태: 연결됨 - 세기1 감지');
  } else if (data.toLowerCase().includes('coloring')) {
    // 색칠 단계 트리거
    if (capturesDone >= 3 && coloringReady && coloringPhase < 3) {
      coloringPhase++;
      coloringReady = false;
      nextColoringTime = millis() + 5000;
      setTimeout(() => {
        coloringReady = true;
      }, 5000);
      statusP.html(`상태: coloring 단계 ${coloringPhase}/3`);
    }
    return; // coloring은 세기 처리와 별개
  }
  
  // 새로운 세기가 감지된 경우에만 업데이트
  if (newIntensity > 0) {
    intensity = newIntensity;
    // 히스토리 기록
    intensityHistory.push({
      value: intensity,
      timestamp: Date.now(),
      rawData: data
    });
    if (intensityHistory.length > 100) {
      intensityHistory.shift();
    }
    // 캡처 로직: 첫 번째 입력 기준으로 거칠기 결정, 이후 5초 간격으로 총 3회 중첩
    if (captureReady && capturesDone < 3 && (intensity ==1 ||intensity === 2 || intensity === 3)) {
      const capturedRoughness = intensity === 3 ? 30 : (intensity === 2 ? 15 : 5);
      roughnessLayers.push(capturedRoughness);
      // 정적인 형상 포인트 생성 및 저장
      const points = generateStaticStrokePoints(circleRadius, capturedRoughness);
      strokeLayers.push({ points, roughness: capturedRoughness });
      capturesDone++;
      captureReady = false;
      nextCaptureTime = millis() + 5000;
      // 5초 후 다음 캡처 허용
      setTimeout(() => {
        captureReady = true;
      }, 5000);
    }
  }
}

// 거친 스트로크로 원 그리기 (세기2, 세기3일 때 사용)
function drawRoughCircle(x, y, radius, roughness, intensityLevel) {
  beginShape();
  let angleStep = TWO_PI / 360; // 부드러운 원을 위해 많은 점 사용
  
  for (let angle = 0; angle <= TWO_PI; angle += angleStep) {
    // 기본 원의 좌표
    let baseX = x + cos(angle) * radius;
    let baseY = y + sin(angle) * radius;
    
    // 노이즈를 사용하여 거칠기 추가
    let noiseScale = 5.0;
    let noiseX = (noise(angle * noiseScale, frameCount * 0.02) - 0.5) * roughness;
    let noiseY = (noise(angle * noiseScale + 100, frameCount * 0.02) - 0.5) * roughness;
    
    // 세기에 따라 추가적인 불규칙성
    let intensityVariation = sin(angle * 3 + frameCount * 0.05) * roughness * 0.3 * (intensityLevel / 3);
    
    // 최종 좌표
    let finalX = baseX + noiseX + intensityVariation;
    let finalY = baseY + noiseY + intensityVariation * 0.7;
    
    vertex(finalX, finalY);
  }
  endShape(CLOSE);
}

// 정적 형상 그리기 (저장된 포인트 사용)
function drawStaticShape(points) {
  beginShape();
  for (let p of points) {
    vertex(p.x, p.y);
  }
  endShape(CLOSE);
}

// 캡처 시점에 정적인 스트로크 포인트 생성 (랜덤은 캡처 순간에만 사용되어 고정됨)
function generateStaticStrokePoints(radius, roughness) {
  const points = [];
  const steps = 360;
  const angleStep = TWO_PI / steps;
  for (let i = 0; i < steps; i++) {
    const angle = i * angleStep;
    const baseX = cos(angle) * radius;
    const baseY = sin(angle) * radius;
    // 캡처 순간의 미세한 랜덤 변형 (정적으로 저장됨)
    const jitterX = (random() - 0.5) * roughness;
    const jitterY = (random() - 0.5) * roughness;
    points.push({ x: baseX + jitterX, y: baseY + jitterY });
  }
  return points;
}

// 3개 레이어의 평균 형상 계산 (인덱스별 평균)
function getAveragedShapePoints() {
  if (strokeLayers.length < 1) return null;
  const n = strokeLayers[0].points.length;
  const layersToUse = Math.min(3, strokeLayers.length);
  const acc = new Array(n).fill(0).map(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < layersToUse; i++) {
    const pts = strokeLayers[i].points;
    for (let j = 0; j < n; j++) {
      acc[j].x += pts[j].x;
      acc[j].y += pts[j].y;
    }
  }
  for (let j = 0; j < n; j++) {
    acc[j].x /= layersToUse;
    acc[j].y /= layersToUse;
  }
  return acc;
}

// 윈도우 리사이즈 처리
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  positionButtons();
}

// --- UI: 전송/리셋 버튼 관리 ---
function ensureSendButton() {
  if (sendBtn) {
    sendBtn.show();
    positionButtons();
    return;
  }
  sendBtn = createButton('전송');
  sendBtn.mousePressed(handleSend);
  sendBtn.size(100, 40);
  sendBtn.style('font-size', '16px');
  positionButtons();
}

function ensureResetButton() {
  if (resetBtn) {
    resetBtn.show();
    positionButtons();
    return;
  }
  resetBtn = createButton('다시 그리기');
  resetBtn.mousePressed(handleReset);
  resetBtn.size(120, 40);
  resetBtn.style('font-size', '16px');
  positionButtons();
}

function positionButtons() {
  const margin = 20;
  if (sendBtn && mode === 'capture' && coloringPhase >= 3) {
    sendBtn.position(windowWidth - 100 - margin, windowHeight - 40 - margin);
    sendBtn.show();
  } else if (sendBtn) {
    sendBtn.hide();
  }
  if (resetBtn && mode === 'gallery') {
    resetBtn.position(windowWidth - 120 - margin, windowHeight - 40 - margin);
    resetBtn.show();
  } else if (resetBtn) {
    resetBtn.hide();
  }
}

// --- 전송/리셋 동작 ---
function handleSend() {
  // 평균 형상 확보
  const shape = getAveragedShapePoints() || (strokeLayers[strokeLayers.length - 1]?.points);
  if (!shape) return;
  // 윈도우 내 랜덤 위치 선정 (여백 포함)
  const bounds = getShapeBounds(shape);
  const radiusX = (bounds.maxX - bounds.minX) / 2;
  const radiusY = (bounds.maxY - bounds.minY) / 2;
  const margin = 40 + Math.max(radiusX, radiusY);
  const pos = {
    x: random(margin, windowWidth - margin),
    y: random(margin, windowHeight - margin)
  };
  sentCircles.push({ points: shape, pos });
  // 화면 전환
  mode = 'gallery';
  positionButtons();
}

function handleReset() {
  // 캡처 관련 상태만 초기화, 전송된 원은 유지
  roughnessLayers = [];
  strokeLayers = [];
  capturesDone = 0;
  captureReady = true;
  coloringPhase = 0;
  coloringReady = true;
  intensity = 0;
  mode = 'capture';
  positionButtons();
}

function getShapeBounds(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
