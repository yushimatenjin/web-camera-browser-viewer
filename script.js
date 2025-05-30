const elements = {
    video: document.getElementById('webcamVideo'),
    noiseCanvas: document.getElementById('noiseCanvas'),
    toggleWebcamBtn: document.getElementById('toggleWebcamBtn'),
    statusMessage: document.getElementById('statusMessage'),
    messageBox: document.getElementById('messageBox'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    toggleApiKeyBtn: document.getElementById('toggleApiKeyBtn'),
    analyzeImageBtn: document.getElementById('analyzeImageBtn'),
    analysisModal: document.getElementById('analysisModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalLoader: document.getElementById('modalLoader'),
    modalResult: document.getElementById('modalResult'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cameraButtonsContainer: document.getElementById('cameraButtonsContainer')
};

const appState = {
    currentStream: null,
    availableCameras: [],
    currentCameraDeviceId: null,
    currentLanguage: 'ja',
    noiseAnimationId: null,
    gl: null
};

// 多言語対応のための翻訳データ
const translations = {
    ja: {
        toggleWebcamBtnStart: 'Webカメラを起動',
        toggleWebcamBtnStop: 'Webカメラを停止',
        analyzeImageBtn: '✨何が写ってる？',
        statusInitial: '上のボタンをクリックしてWebカメラを起動してください。',
        statusStarting: 'Webカメラを起動しています...',
        statusStarted: 'Webカメラが起動しました。',
        statusStopped: 'Webカメラが停止しました。',
        statusNoCameraSelected: '利用可能なカメラがありません。',
        messageBoxStarting: 'カメラを起動中...',
        messageBoxAccessDenied: 'アクセスが拒否されました',
        messageBoxCameraNotFound: 'カメラが見つかりません',
        messageBoxCameraInUse: 'カメラが使用できません',
        messageBoxError: 'エラーが発生しました',
        statusAccessDenied: 'Webカメラの使用が拒否されました。ブラウザの設定を確認してください。',
        statusCameraNotFound: 'Webカメラが見つかりませんでした。接続を確認してください。',
        statusCameraInUse: 'Webカメラが既に使用されているか、ハードウェアエラーが発生しました。',
        statusGenericError: 'Webカメラの起動中にエラーが発生しました: ',
        statusDeviceListError: 'デバイスの列挙中にエラーが発生しました: ',
        videoElementError: 'ビデオ要素でエラーが発生しました。',
        cameraNamePlaceholder: 'カメラが選択されていません',
        cameraNameFormat: 'カメラ {index}',
        modalTitle: '画像分析結果',
        modalLoading: '画像を分析中...',
        modalError: '分析中にエラーが発生しました。',
        modalClose: '閉じる',
        analysisPrompt: 'この画像に写っているものを日本語で詳細に説明してください。',
        analysisNoStream: 'Webカメラが起動していません。画像を分析できません。',
        apiKeyRequired: 'Gemini APIキーを入力してください。',
        apiKeyInvalid: 'APIキーが無効です。',
    },
    en: {
        toggleWebcamBtnStart: 'Start Webcam',
        toggleWebcamBtnStop: 'Stop Webcam',
        analyzeImageBtn: '✨What\'s in the picture?',
        statusInitial: 'Click the button above to start the webcam.',
        statusStarting: 'Starting webcam...',
        statusStarted: 'Webcam started.',
        statusStopped: 'Webcam stopped.',
        statusNoCameraSelected: 'No cameras available.',
        messageBoxStarting: 'Starting camera...',
        messageBoxAccessDenied: 'Access Denied',
        messageBoxCameraNotFound: 'Camera Not Found',
        messageBoxCameraInUse: 'Camera In Use',
        messageBoxError: 'An error occurred',
        statusAccessDenied: 'Webcam usage denied. Please check your browser settings.',
        statusCameraNotFound: 'Webcam not found. Please check connection.',
        statusCameraInUse: 'Webcam is already in use or a hardware error occurred.',
        statusGenericError: 'An error occurred while starting the webcam: ',
        statusDeviceListError: 'An error occurred while enumerating devices: ',
        videoElementError: 'An error occurred with the video element.',
        cameraNamePlaceholder: 'No camera selected',
        cameraNameFormat: 'Camera {index}',
        modalTitle: 'Image Analysis Result',
        modalLoading: 'Analyzing image...',
        modalError: 'An error occurred during analysis.',
        modalClose: 'Close',
        analysisPrompt: 'Please describe in detail what is in this image in English.',
        analysisNoStream: 'Webcam is not active. Cannot analyze image.',
        apiKeyRequired: 'Please enter your Gemini API key.',
        apiKeyInvalid: 'Invalid API key.',
    }
};

// WebGLノイズシェーダーの初期化
function initWebGLNoise() {
    const canvas = elements.noiseCanvas;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) {
        console.warn('WebGL not supported');
        return null;
    }
    
    appState.gl = gl;
    
    // 頂点シェーダー
    const vertexShaderSource = `
        attribute vec2 a_position;
        varying vec2 v_uv;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_uv = a_position * 0.5 + 0.5;
        }
    `;
    
    // フラグメントシェーダー（ノイズエフェクト）
    const fragmentShaderSource = `
        precision mediump float;
        varying vec2 v_uv;
        uniform float u_time;
        uniform vec2 u_resolution;
        
        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
        }
        
        float noise(vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }
        
        void main() {
            vec2 st = v_uv * 50.0;
            st += u_time * 0.5;
            
            float n = noise(st);
            n = n * 0.7 + random(v_uv + u_time) * 0.3;
            
            vec3 color = vec3(n * 0.2, n * 0.25, n * 0.3);
            color += vec3(0.05, 0.05, 0.08);
            
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    
    // シェーダーのコンパイル
    function compileShader(source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    
    // プログラムの作成
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
    }
    
    // 頂点バッファの設定
    const positions = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
         1,  1
    ]);
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    const timeLocation = gl.getUniformLocation(program, 'u_time');
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    
    return {
        program,
        positionBuffer,
        positionLocation,
        timeLocation,
        resolutionLocation
    };
}

// ノイズアニメーションの描画
function drawNoise(noiseData) {
    if (!noiseData || !appState.gl) return;
    
    const canvas = elements.noiseCanvas;
    const gl = appState.gl;
    
    // キャンバスサイズの更新
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(noiseData.program);
    
    // uniforms の設定
    gl.uniform1f(noiseData.timeLocation, performance.now() * 0.001);
    gl.uniform2f(noiseData.resolutionLocation, canvas.width, canvas.height);
    
    // 頂点属性の設定
    gl.bindBuffer(gl.ARRAY_BUFFER, noiseData.positionBuffer);
    gl.enableVertexAttribArray(noiseData.positionLocation);
    gl.vertexAttribPointer(noiseData.positionLocation, 2, gl.FLOAT, false, 0, 0);
    
    // 描画
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ノイズアニメーションの開始/停止
function toggleNoise(show) {
    if (show) {
        elements.noiseCanvas.style.display = 'block';
        elements.video.style.display = 'none';
        
        const noiseData = initWebGLNoise();
        if (noiseData) {
            function animate() {
                if (elements.noiseCanvas.style.display !== 'none') {
                    drawNoise(noiseData);
                    appState.noiseAnimationId = requestAnimationFrame(animate);
                }
            }
            animate();
        }
    } else {
        elements.noiseCanvas.style.display = 'none';
        elements.video.style.display = 'block';
        
        if (appState.noiseAnimationId) {
            cancelAnimationFrame(appState.noiseAnimationId);
            appState.noiseAnimationId = null;
        }
    }
}

// メッセージボックス表示の最適化
function showMessageBox(messageKey, show) {
    const message = translations[appState.currentLanguage][messageKey];
    elements.messageBox.textContent = message;
    elements.messageBox.classList.toggle('show', show);
}

// モーダル表示の最適化
function toggleModal(show) {
    elements.analysisModal.classList.toggle('show', show);
}

// 翻訳の適用を最適化
function updateUIForLanguage(lang) {
    appState.currentLanguage = lang;
    const t = translations[lang];

    // ボタンテキストの更新
    elements.toggleWebcamBtn.textContent = appState.currentStream ? t.toggleWebcamBtnStop : t.toggleWebcamBtnStart;
    elements.analyzeImageBtn.textContent = t.analyzeImageBtn;

    // ステータスメッセージの更新
    if (!appState.currentStream) {
        elements.statusMessage.textContent = t.statusInitial;
    }

    // モーダル要素の更新
    elements.modalTitle.textContent = t.modalTitle;
    elements.closeModalBtn.textContent = t.modalClose;

    // カメラボタンの更新
    enumerateDevices();
    updateAnalyzeButtonState();
}

/**
 * 利用可能なカメラデバイスを列挙し、ボタンとして表示する関数
 */
async function enumerateDevices() {
    try {
        // まず、一時的にストリームを取得してデバイス名を公開させる
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        tempStream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        appState.availableCameras = devices.filter(device => device.kind === 'videoinput');

        elements.cameraButtonsContainer.innerHTML = ''; // 既存のボタンをクリア

        if (appState.availableCameras.length > 0) {
            appState.availableCameras.forEach((device, index) => {
                const button = document.createElement('button');
                button.dataset.deviceId = device.deviceId;
                button.textContent = device.label || translations[appState.currentLanguage].cameraNameFormat.replace('{index}', index + 1);
                button.className = `
                    px-4 py-2 rounded-full text-sm font-semibold shadow-sm
                    hover:scale-105 active:scale-95 transition transform
                    ${device.deviceId === appState.currentCameraDeviceId ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
                    ${appState.currentStream ? 'opacity-50 cursor-not-allowed' : ''}
                `;
                button.disabled = appState.currentStream; // カメラ起動中はボタンを無効化

                button.addEventListener('click', () => {
                    if (!appState.currentStream) {
                        appState.currentCameraDeviceId = device.deviceId;
                        startWebcam(); // 選択されたカメラで起動
                        updateCameraButtonsState(); // ボタンの状態を更新
                    }
                });
                elements.cameraButtonsContainer.appendChild(button);
            });

            // 初回ロード時、または現在のカメラがリストにない場合、最初のカメラを選択
            if (!appState.currentCameraDeviceId || !appState.availableCameras.some(cam => cam.deviceId === appState.currentCameraDeviceId)) {
                appState.currentCameraDeviceId = appState.availableCameras[0].deviceId;
            }
            updateCameraButtonsState(); // ボタンの状態を更新
        } else {
            elements.statusMessage.textContent = translations[appState.currentLanguage].statusCameraNotFound;
            appState.currentCameraDeviceId = null;
        }
    } catch (error) {
        console.error('デバイスの列挙に失敗しました:', error);
        elements.statusMessage.textContent = translations[appState.currentLanguage].statusDeviceListError + error.message;
        appState.currentCameraDeviceId = null;
    } finally {
        updateAnalyzeButtonState(); // Gemini APIボタンの状態も更新
    }
}

/**
 * カメラ選択ボタンの状態を更新する関数
 */
function updateCameraButtonsState() {
    const buttons = elements.cameraButtonsContainer.querySelectorAll('button');
    buttons.forEach(button => {
        const isSelected = button.dataset.deviceId === appState.currentCameraDeviceId;
        button.className = `
            px-4 py-2 rounded-full text-sm font-semibold shadow-sm
            hover:scale-105 active:scale-95 transition transform
            ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}
            ${appState.currentStream ? 'opacity-50 cursor-not-allowed' : ''}
        `;
        button.disabled = appState.currentStream; // カメラ起動中はボタンを無効化
    });
}

/**
 * Webカメラを起動する関数
 */
async function startWebcam() {
    if (!appState.currentCameraDeviceId) {
        elements.statusMessage.textContent = translations[appState.currentLanguage].statusNoCameraSelected;
        return;
    }

    showMessageBox('messageBoxStarting', true);
    elements.statusMessage.textContent = translations[appState.currentLanguage].statusStarting;
    elements.toggleWebcamBtn.disabled = true;
    elements.analyzeImageBtn.disabled = true;

    // 既存のストリームがあれば停止する
    if (appState.currentStream) {
        stopWebcam();
    }

    try {
        // 選択されたカメラの映像を取得
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: appState.currentCameraDeviceId } },
            audio: false
        });
        appState.currentStream = stream;
        elements.video.srcObject = stream;
        elements.video.play();

        // ノイズを非表示にしてビデオを表示
        toggleNoise(false);

        elements.toggleWebcamBtn.textContent = translations[appState.currentLanguage].toggleWebcamBtnStop;
        elements.statusMessage.textContent = translations[appState.currentLanguage].statusStarted;
        showMessageBox('', false);
    } catch (error) {
        console.error('Webカメラへのアクセスに失敗しました:', error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            elements.statusMessage.textContent = translations[appState.currentLanguage].statusAccessDenied;
            showMessageBox('messageBoxAccessDenied', true);
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            elements.statusMessage.textContent = translations[appState.currentLanguage].statusCameraNotFound;
            showMessageBox('messageBoxCameraNotFound', true);
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            elements.statusMessage.textContent = translations[appState.currentLanguage].statusCameraInUse;
            showMessageBox('messageBoxCameraInUse', true);
        } else {
            elements.statusMessage.textContent = translations[appState.currentLanguage].statusGenericError + error.message;
            showMessageBox('messageBoxError', true);
        }
        appState.currentStream = null;
    } finally {
        elements.toggleWebcamBtn.disabled = false;
        updateCameraButtonsState();
        updateAnalyzeButtonState();
    }
}

/**
 * Webカメラを停止する関数
 */
function stopWebcam() {
    if (appState.currentStream) {
        appState.currentStream.getTracks().forEach(track => track.stop());
        elements.video.srcObject = null;
        appState.currentStream = null;
        elements.toggleWebcamBtn.textContent = translations[appState.currentLanguage].toggleWebcamBtnStart;
        elements.statusMessage.textContent = translations[appState.currentLanguage].statusStopped;
        showMessageBox('', false);
        
        // ビデオを非表示にしてノイズを表示
        toggleNoise(true);
    }
    updateCameraButtonsState();
    updateAnalyzeButtonState();
}

// APIキーの検証
function validateApiKey(apiKey) {
    return apiKey && apiKey.trim().length > 0;
}

// APIキー入力の監視
elements.apiKeyInput.addEventListener('input', () => {
    const apiKey = elements.apiKeyInput.value.trim();
    if (validateApiKey(apiKey)) {
        localStorage.setItem('geminiApiKey', apiKey);
    } else {
        localStorage.removeItem('geminiApiKey');
    }
    elements.analyzeImageBtn.disabled = !validateApiKey(apiKey) || !appState.currentStream;
});

// ページロード時にlocalStorageからAPIキーを復元
window.addEventListener('DOMContentLoaded', () => {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        elements.apiKeyInput.value = savedKey;
    }
});

/**
 * Gemini APIボタンの状態を更新する関数
 */
function updateAnalyzeButtonState() {
    const apiKey = elements.apiKeyInput.value.trim();
    elements.analyzeImageBtn.disabled = !validateApiKey(apiKey) || !appState.currentStream;
}

/**
 * Webカメラからフレームをキャプチャし、Gemini APIで分析する関数
 */
async function captureFrameAndAnalyze() {
    if (!appState.currentStream) {
        elements.statusMessage.textContent = translations[appState.currentLanguage].analysisNoStream;
        return;
    }

    const apiKey = elements.apiKeyInput.value.trim();
    if (!validateApiKey(apiKey)) {
        elements.statusMessage.textContent = translations[appState.currentLanguage].apiKeyRequired;
        return;
    }

    toggleModal(true);
    elements.modalTitle.textContent = translations[appState.currentLanguage].modalTitle;
    elements.modalResult.textContent = translations[appState.currentLanguage].modalLoading;
    elements.modalLoader.classList.remove('hidden');
    elements.closeModalBtn.disabled = true;

    try {
        const canvas = document.createElement('canvas');
        canvas.width = elements.video.videoWidth;
        canvas.height = elements.video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(elements.video, 0, 0, canvas.width, canvas.height);

        const base64ImageData = canvas.toDataURL('image/png').split(',')[1];

        const prompt = translations[appState.currentLanguage].analysisPrompt;
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: base64ImageData
                            }
                        }
                    ]
                }
            ],
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
        }

        // ★正常なレスポンス時のみAPIキーを保存
        localStorage.setItem('geminiApiKey', apiKey);

        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            elements.modalResult.textContent = text;
        } else {
            elements.modalResult.textContent = translations[appState.currentLanguage].modalError + ' (No valid response from LLM)';
        }
    } catch (error) {
        console.error('Gemini API呼び出し中にエラーが発生しました:', error);
        elements.modalResult.textContent = translations[appState.currentLanguage].modalError + ` (${error.message})`;
    } finally {
        elements.modalLoader.classList.add('hidden');
        elements.closeModalBtn.disabled = false;
    }
}

/**
 * ボタンクリックイベントハンドラ (Webカメラ起動/停止)
 */
elements.toggleWebcamBtn.addEventListener('click', () => {
    if (appState.currentStream) {
        stopWebcam();
    } else {
        startWebcam();
    }
});

// Gemini APIボタンのイベントリスナー
elements.analyzeImageBtn.addEventListener('click', captureFrameAndAnalyze);

// モーダルを閉じるボタンのイベントリスナー
elements.closeModalBtn.addEventListener('click', () => {
    toggleModal(false);
});

// ページロード時とデバイス変更時にカメラリストを更新
window.addEventListener('load', async () => {
    appState.currentLanguage = 'ja';
    updateUIForLanguage(appState.currentLanguage);
    
    // 初期状態でノイズエフェクトを表示
    toggleNoise(true);
    
    await enumerateDevices();
    updateAnalyzeButtonState();
});

navigator.mediaDevices.ondevicechange = async () => {
    await enumerateDevices(); // デバイスの抜き差しに対応
    updateAnalyzeButtonState(); // Gemini APIボタンの状態も更新
    // カメラが起動中であれば、現在のカメラがまだ存在するか確認し、存在しない場合は停止
    if (appState.currentStream && !appState.availableCameras.some(cam => cam.deviceId === appState.currentCameraDeviceId)) {
        stopWebcam();
        elements.statusMessage.textContent = translations[appState.currentLanguage].statusCameraNotFound;
    } else if (appState.currentStream && appState.currentCameraDeviceId) {
        // 同じカメラがまだ存在する場合でも、ストリームを再起動して最新の状態を反映
        startWebcam();
    }
};

// ページロード時にビデオ要素の準備状況を確認
elements.video.onloadedmetadata = () => {
    console.log('Video metadata loaded.');
};

elements.video.onerror = (e) => {
    console.error('Video element error:', e);
    elements.statusMessage.textContent = translations[appState.currentLanguage].videoElementError;
};

// APIキーの表示/非表示を切り替える
elements.toggleApiKeyBtn.addEventListener('click', () => {
    const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
    elements.apiKeyInput.type = type;
    
    // アイコンを更新
    elements.toggleApiKeyBtn.innerHTML = type === 'password' 
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
           </svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
            <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
           </svg>`;
}); 