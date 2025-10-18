// --- 定数とDOM要素 ---
const SVG_SIZE = 500;
const SEGMENT_COUNT = 8; // 各円を8分割
const COLORS = ['#FFD700', '#0074D9', '#FF4136', '#2ECC40', '#AAAAAA', '#F012BE']; // 6色
const AXIS_NAMES = ['X軸', 'Y軸', 'Z軸'];

const svg = document.getElementById('puzzleSvg');
const moveCounterEl = document.getElementById('moveCounter');
const axisSelectors = document.getElementById('axisSelectors');
const rotateCWButton = document.getElementById('rotateCW');
const rotateCCWButton = document.getElementById('rotateCCW');
const shuffleButton = document.getElementById('shuffleButton');
const undoButton = document.getElementById('undoButton');
const solveButton = document.getElementById('solveButton');
const messageEl = document.getElementById('message');

// --- 状態管理 ---
let currentBoardState = []; // 各セグメントの色インデックスを格納する配列
let goalState = [];         // 揃った状態
let history = [];           // Undo用履歴スタック
let moveCount = 0;
let activeAxis = 0;         // 現在選択中の軸 (0:X, 1:Y, 2:Z)

// --- セグメント定義 (簡略化されたベン図構造) ---

// 3つの円が交差してできるセグメント（領域）の集合を定義します。
// 各領域がどの円（軸）に属するかを定義。例: [0, 1] はX軸とY軸に属する領域
const SEGMENT_AXIS_MAP = [
    { id: 0, axes: [0, 1, 2], name: '中央' }, // 3軸の共通交差部分 (1)
    { id: 1, axes: [0, 1], name: 'X-Y交差' }, // 2軸の交差部分 (3箇所)
    { id: 2, axes: [1, 2], name: 'Y-Z交差' },
    { id: 3, axes: [0, 2], name: 'X-Z交差' },
    { id: 4, axes: [0], name: 'X単独' },      // 1軸のみの部分 (3箇所)
    { id: 5, axes: [1], name: 'Y単独' },
    { id: 6, axes: [2], name: 'Z単独' },
    // 実際にはもっと多くの領域ができますが、ロジックデモのため7つに簡略化
];

// 各軸の回転の影響範囲を定義 (どのセグメントIDが影響を受けるか)
// ルービックキューブの「層の回転」に相当する、複雑な入れ替えロジック
const AXIS_ROTATION_MAP = [
    // X軸 (0) の回転の影響範囲 (デモ用抽象化)
    { id: 0, cw: [4, 1, 0, 3], ccw: [4, 3, 0, 1], indices: [4, 1, 0, 3] }, // 4つのセグメントを循環
    // Y軸 (1) の回転の影響範囲
    { id: 1, cw: [5, 2, 0, 1], ccw: [5, 1, 0, 2], indices: [5, 2, 0, 1] }, // 別の4つのセグメントを循環
    // Z軸 (2) の回転の影響範囲
    { id: 2, cw: [6, 3, 0, 2], ccw: [6, 2, 0, 3], indices: [6, 3, 0, 2] }, // さらに別の4つのセグメントを循環
];


// --- SVG描画のための幾何学データ（ダミー） ---
// 実際の描画は複雑な幾何学計算が必要ですが、ここではベン図を模したダミーのPathデータを使用します
const DUMMY_PATHS = [
    // 中央の交差部分
    "M 250 225 L 250 250 L 270 270 Z", // 0: 中央
    // 2軸交差
    "M 200 100 L 250 150 L 200 200 Z", // 1: X-Y交差
    "M 300 300 L 350 350 L 400 300 Z", // 2: Y-Z交差
    "M 400 100 L 350 150 L 300 100 Z", // 3: X-Z交差
    // 単独部分
    "M 150 50 L 200 50 L 250 100 L 200 100 Z", // 4: X単独
    "M 50 300 L 100 350 L 150 300 Z",      // 5: Y単独
    "M 450 300 L 400 350 L 350 300 Z"       // 6: Z単独
];

// --- 初期化と描画 ---

function initializeState() {
    let state = [];
    // 7つのセグメントに色を割り当てる (例: 3色と残りを2色ずつ)
    state.push(COLORS[0]); // 中央
    state.push(COLORS[1]); state.push(COLORS[1]); // X-Y交差
    state.push(COLORS[2]); state.push(COLORS[2]); // Y-Z交差
    state.push(COLORS[3]); state.push(COLORS[3]); // X-Z交差
    
    // 7セグメント分の目標状態を定義
    goalState = state.slice(0, SEGMENT_AXIS_MAP.length); 
    
    return goalState;
}

// 盤面全体をSVGに描画
function renderBoard(state) {
    svg.innerHTML = '';
    
    // 背景の円を描画 (軸のガイド)
    const axisCircles = [
        { cx: 250, cy: 150, r: 100, color: '#F0F0FF' }, // X軸 (上)
        { cx: 200, cy: 300, r: 100, color: '#F0FFF0' }, // Y軸 (左下)
        { cx: 300, cy: 300, r: 100, color: '#FFF0F0' }  // Z軸 (右下)
    ];

    axisCircles.forEach(c => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", 'circle');
        circle.setAttribute('cx', c.cx);
        circle.setAttribute('cy', c.cy);
        circle.setAttribute('r', c.r);
        circle.setAttribute('fill', c.color);
        circle.setAttribute('opacity', 0.5);
        svg.appendChild(circle);
    });

    // 各セグメントを描画
    SEGMENT_AXIS_MAP.forEach((segment, sIndex) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        path.setAttribute('d', DUMMY_PATHS[sIndex]);
        path.setAttribute('fill', state[sIndex]);
        path.setAttribute('data-id', segment.id);
        path.classList.add('segment');
        svg.appendChild(path);
    });
}

// --- ゲームロジック ---

// 軸を回転させるロジック (色の配列を交換)
function rotateAxis(axisIndex, direction) {
    saveHistory();
    
    const rotationMap = AXIS_ROTATION_MAP[axisIndex];
    const segmentIndices = rotationMap.indices;
    
    // 影響を受けるセグメントの色を取得
    const affectedColors = segmentIndices.map(i => currentBoardState[i]);
    
    if (direction === 'CW') {
        // 時計回り: 最後の要素を先頭に移動
        affectedColors.unshift(affectedColors.pop());
    } else {
        // 反時計回り: 先頭の要素を末尾に移動
        affectedColors.push(affectedColors.shift());
    }
    
    // 新しい色を盤面状態に反映
    segmentIndices.forEach((i, idx) => {
        currentBoardState[i] = affectedColors[idx];
    });

    moveCount++;
    updateMoveCounter();
    renderBoard(currentBoardState);
    checkWin();
}

// 勝利判定
function checkWin() {
    // goalStateは色コードで、currentBoardStateも色コードなので直接比較
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

// 盤面状態を履歴に保存
function saveHistory() {
    history.push(JSON.stringify(currentBoardState));
}

// シャッフル
function shuffleBoard() {
    currentBoardState = JSON.parse(JSON.stringify(goalState));
    
    // 30回ランダムな回転を実行
    for (let i = 0; i < 30; i++) {
        const r = Math.floor(Math.random() * 3); // 0, 1, 2の軸
        const d = Math.random() < 0.5 ? 'CW' : 'CCW';
        
        // シャッフル中もロジックを使って回転させる
        const rotationMap = AXIS_ROTATION_MAP[r];
        const segmentIndices = rotationMap.indices;
        let affectedColors = segmentIndices.map(i => currentBoardState[i]);
        
        if (d === 'CW') {
            affectedColors.unshift(affectedColors.pop());
        } else {
            affectedColors.push(affectedColors.shift());
        }
        segmentIndices.forEach((i, idx) => {
            currentBoardState[i] = affectedColors[idx];
        });
    }
    
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
    
    const previousState = history.pop();
    currentBoardState = JSON.parse(previousState);
    
    moveCount--;
    updateMoveCounter();
    renderBoard(currentBoardState);
    messageEl.textContent = '操作を一つ戻しました。';
    messageEl.style.color = 'black';
    checkWin();
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

axisSelectors.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        document.querySelector('.axis-selector.active').classList.remove('active');
        e.target.classList.add('active');
        activeAxis = parseInt(e.target.dataset.axis);
    }
});

rotateCWButton.addEventListener('click', () => rotateAxis(activeAxis, 'CW'));
rotateCCWButton.addEventListener('click', () => rotateAxis(activeAxis, 'CCW'));
shuffleButton.addEventListener('click', shuffleBoard);
undoButton.addEventListener('click', undoLastMove);
solveButton.addEventListener('click', solveBoard);

// --- 初期実行 ---
window.onload = () => {
    currentBoardState = initializeState();
    shuffleBoard(); 
};
