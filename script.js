// --- 定数とDOM要素 ---
const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const SEGMENTS_PER_RING = 12;
const RING_RADIUS = [40, 80, 120]; // 各リングの中心からの距離（SVG座標）
const RING_WIDTH = 40; 
const COLORS = ['#FFD700', '#0074D9', '#FF4136', '#2ECC40', '#AAAAAA', '#F012BE']; // 6色
const START_ANGLE = 270; // 12時の位置からスタート
const ANGLE_STEP = 360 / SEGMENTS_PER_RING;

const svg = document.getElementById('puzzleSvg');
const moveCounterEl = document.getElementById('moveCounter');
const ringSelectors = document.getElementById('ringSelectors');
const rotateCWButton = document.getElementById('rotateCW');
const rotateCCWButton = document.getElementById('rotateCCW');
const shuffleButton = document.getElementById('shuffleButton');
const undoButton = document.getElementById('undoButton');
const solveButton = document.getElementById('solveButton');
const messageEl = document.getElementById('message');

// --- 状態管理 ---
let currentBoardState = []; // 現在の盤面データ [ [ring0_colors], [ring1_colors], [ring2_colors] ]
let goalState = [];         // 揃った状態
let history = [];           // Undo用履歴スタック
let moveCount = 0;
let activeRing = 0;         // 現在選択中のリング (0:内側, 1:中間, 2:外側)

// --- SVG描画関数 ---

// SVGのパスデータを作成 (円弧)
function describeArc(x, y, radius, startAngle, endAngle) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
        "M", start.x, start.y, 
        "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
        "L", x, y, 
        "Z"
    ].join(" ");
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
        x: centerX + (radius * Math.cos(angleInRadians)),
        y: centerY + (radius * Math.sin(angleInRadians))
    };
}

// 盤面全体をSVGに描画
function renderBoard(state) {
    svg.innerHTML = ''; // 一旦クリア

    state.forEach((ringColors, rIndex) => {
        const radius = RING_RADIUS[rIndex] + (RING_WIDTH / 2); // セグメントの正確な半径

        ringColors.forEach((colorIndex, sIndex) => {
            const start = START_ANGLE + (sIndex * ANGLE_STEP);
            const end = start + ANGLE_STEP;
            
            // 円の中心から外側に伸びるセグメントを描画
            const d = describeArc(CENTER, CENTER, radius, start, end);
            
            const segment = document.createElementNS("http://www.w3.org/2000/svg", 'path');
            segment.setAttribute('d', d);
            segment.setAttribute('fill', COLORS[colorIndex]);
            segment.setAttribute('data-ring', rIndex);
            segment.setAttribute('data-segment', sIndex);
            segment.classList.add('segment');
            svg.appendChild(segment);
        });
    });
}

// --- ゲームロジック ---

// ゴール状態の定義と初期化
function initializeState() {
    let state = [];
    let colorIndex = 0;
    
    // 3つのリングを定義。リングごとに均等に色を配置（例：2セグメントずつ6色）
    for (let r = 0; r < 3; r++) {
        let ring = [];
        for (let s = 0; s < SEGMENTS_PER_RING; s++) {
            ring.push(colorIndex);
            colorIndex = (colorIndex + 1) % COLORS.length;
        }
        state.push(ring);
    }
    // Deep Copyでゴール状態を保存
    goalState = JSON.parse(JSON.stringify(state)); 
    return state;
}

// 盤面状態を履歴に保存
function saveHistory() {
    // Deep Copy
    history.push(JSON.parse(JSON.stringify(currentBoardState)));
}

// リングを回転させるロジック
function rotateRing(ringIndex, direction) {
    saveHistory(); // 操作前に履歴を保存
    
    let ring = currentBoardState[ringIndex];
    if (direction === 'CW') {
        // 時計回り: 末尾を先頭に移動
        ring.unshift(ring.pop());
    } else {
        // 反時計回り: 先頭を末尾に移動
        ring.push(ring.shift());
    }
    
    moveCount++;
    updateMoveCounter();
    renderBoard(currentBoardState);
    checkWin();
}

// 勝利判定
function checkWin() {
    const isWin = JSON.stringify(currentBoardState) === JSON.stringify(goalState);
    if (isWin) {
        messageEl.textContent = '🏆 パズルクリア！おめでとうございます！ 🏆';
        messageEl.style.color = 'blue';
    } else {
        messageEl.textContent = '';
    }
}

// --- ユーティリティ機能 ---

// 手数カウンター更新
function updateMoveCounter() {
    moveCounterEl.textContent = `手数: ${moveCount}`;
}

// シャッフル
function shuffleBoard() {
    messageEl.textContent = 'シャッフル中...';
    
    // ゴール状態からスタート
    currentBoardState = JSON.parse(JSON.stringify(goalState));
    
    // 50回ランダムな回転を実行
    for (let i = 0; i < 50; i++) {
        const r = Math.floor(Math.random() * 3); // 0, 1, 2のリング
        const d = Math.random() < 0.5 ? 'CW' : 'CCW'; // 方向
        
        let ring = currentBoardState[r];
        if (d === 'CW') {
            ring.unshift(ring.pop());
        } else {
            ring.push(ring.shift());
        }
    }
    
    // 状態をリセット
    history = [];
    moveCount = 0;
    updateMoveCounter();
    renderBoard(currentBoardState);
    messageEl.textContent = '新しいパズルがスタートしました！';
    messageEl.style.color = 'black';
}

// Undo (やり直し)
function undoLastMove() {
    if (history.length === 0) {
        messageEl.textContent = 'これ以上、操作を戻せません。';
        messageEl.style.color = 'red';
        return;
    }
    
    // 履歴から一つ前の状態をポップ
    const previousState = history.pop();
    currentBoardState = previousState;
    
    moveCount--;
    updateMoveCounter();
    renderBoard(currentBoardState);
    messageEl.textContent = '操作を一つ戻しました。';
    messageEl.style.color = 'black';
    checkWin(); // 戻した結果、揃う可能性もあるためチェック
}

// 全部揃える
function solveBoard() {
    currentBoardState = JSON.parse(JSON.stringify(goalState));
    history = [];
    moveCount = 0;
    updateMoveCounter();
    renderBoard(currentBoardState);
    messageEl.textContent = '目標状態にリセットしました。';
    messageEl.style.color = 'black';
}

// --- イベントリスナー ---

ringSelectors.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        // アクティブなリングを更新
        document.querySelector('.ring-selector.active').classList.remove('active');
        e.target.classList.add('active');
        activeRing = parseInt(e.target.dataset.ring);
    }
});

rotateCWButton.addEventListener('click', () => rotateRing(activeRing, 'CW'));
rotateCCWButton.addEventListener('click', () => rotateRing(activeRing, 'CCW'));
shuffleButton.addEventListener('click', shuffleBoard);
undoButton.addEventListener('click', undoLastMove);
solveButton.addEventListener('click', solveBoard);

// --- 初期実行 ---
window.onload = () => {
    currentBoardState = initializeState();
    shuffleBoard(); // ゲーム開始時はシャッフルから
};
