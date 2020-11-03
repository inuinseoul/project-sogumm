/*!
 *
 * 후동이 소금구이
 * 박인우, 이형석, 김주영, 이소현
 *
 */

let big = 0;
let context = {};
const socket = io();
let userId;
let users = [];

$(function () {
  console.log('Loaded Main');

  let roomId;
  let remoteUserId;
  let isOffer;
  let today = new Date();

  const mediaHandler = new MediaHandler();
  const peerHandler = new PeerHandler({
    send: send,
  });
  const animationTime = 500;
  const isSafari = DetectRTC.browser.isSafari;
  const isMobile = DetectRTC.isMobileDevice;
  const mediaOption = {
    audio: true,
    video: {
      mandatory: {
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30,
      },
      optional: [
        { googNoiseReduction: true }, // Likely removes the noise in the captured video stream at the expense of computational effort.
        { facingMode: 'user' }, // Select the front/user facing camera or the rear/environment facing camera if available (on Phone)
      ],
    },
  };

  // DOM
  const $body = $('body');
  const $createWrap = $('#create-wrap');
  const $waitWrap = $('#wait-wrap');
  const $videoWrap = $('#video-wrap');
  const $uniqueToken = $('#unique-token');

  /**
   * 입장 후 다른 참여자 발견시 호출
   */
  function onDetectUser() {
    console.log('onDetectUser');

    $waitWrap.html(
      [
        '<div class="room-info">',
        '<p>당신을 기다리고 있어요. 참여 하실래요?</p>',
        '<button id="btn-join">Join</button>',
        '</div>',
      ].join('\n')
    );

    $('#btn-join').click(function () {
      isOffer = true;
      peerHandler.getUserMedia(mediaOption, onLocalStream, isOffer);
      $(this).attr('disabled', true);
    });

    $createWrap.slideUp(animationTime);
  }

  /**
   * 참석자 핸들링
   * @param roomId
   * @param userList
   */
  function onJoin(roomId, userList) {
    console.log('onJoin', userList);
    for (var user in userList) {
      users.push(userList[user])
    }
    if (Object.size(userList) > 1) {
      onDetectUser();
    }
  }

  /**
   * 이탈자 핸들링
   * @param userId
   */
  function onLeave(userId) {
    console.log('onLeave', arguments);

    if (remoteUserId === userId) {
      $('#remote-video').remove();
      $body.removeClass('connected').addClass('wait');
      remoteUserId = null;
    }
  }

  /**
   * 소켓 메세지 핸들링
   * @param data
   */
  function onMessage(data) {
    console.log('onMessage', arguments);

    if (!remoteUserId) {
      remoteUserId = data.sender;
    }

    if (data.sdp || data.candidate) {
      peerHandler.signaling(data);
    } else {
      // etc
    }
  }

  /**
   * 소켓 메시지 전송
   * @param data
   */
  function send(data) {
    console.log('send', arguments);
    data.roomId = roomId;
    data.sender = userId;
    socket.send(data);
  }

  /**
   * 방 고유 접속 토큰 생성
   */
  function setRoomToken() {
    const hashValue = (Math.random() * new Date().getTime())
      .toString(32)
      .toUpperCase()
      .replace(/\./g, '-');
    if (location.hash.length > 2) {
      $uniqueToken.attr('href', location.href);
      roomId = location.href;
    } else {
      location.hash = '#' + hashValue;
      roomId = location.href;
    }
  }

  /**
   * 클립보드 복사
   */
  function setClipboard() {
    $uniqueToken.click(function () {
      const link = location.href;

      if (window.clipboardData) {
        window.clipboardData.setData('text', link);
        alert('Copy to Clipboard successful.');
      } else {
        window.prompt('Copy to clipboard: Ctrl+C, Enter', link); // Copy to clipboard: Ctrl+C, Enter
      }
    });
  }

  /**
   * 로컬 스트림 핸들링
   * @param stream
   */
  function onLocalStream(stream) {
    $videoWrap.prepend('<video id="local-video" muted="muted" autoplay />');
    const localVideo = document.querySelector('#local-video');
    mediaHandler.setVideoStream({
      type: 'local',
      el: localVideo,
      stream: stream,
    });

    $body.addClass('room wait');

    if (isMobile && isSafari) {
      mediaHandler.playForIOS(localVideo);
    }
  }

  /**
   * 상대방 스트림 핸들링
   * @param stream
   */
  function onRemoteStream(stream) {
    console.log('onRemoteStream', stream);

    $videoWrap.prepend('<video id="remote-video" autoplay />');
    const remoteVideo = document.querySelector('#remote-video');
    mediaHandler.setVideoStream({
      type: 'remote',
      el: remoteVideo,
      stream: stream,
    });

    $body.removeClass('wait').addClass('connected');

    if (isMobile && isSafari) {
      mediaHandler.playForIOS(remoteVideo);
    }
  }

  /**
   * 여기부터 음성관련 코드
   */

  if (typeof webkitSpeechRecognition !== 'function') {
    alert('크롬에서만 동작 합니다.');
    return false;
  }

  const FIRST_CHAR = /\S/;
  const TWO_LINE = /\n\n/g;
  const ONE_LINE = /\n/g;

  const recognition = new webkitSpeechRecognition();
  const language = 'ko-KR';
  const $audio = document.querySelector('#audio');
  const $btnMic = document.querySelector('#btn-mic');
  const $resultWrap = document.querySelector('#result');
  const $iconMusic = document.querySelector('#icon-music');

  let isRecognizing = false;
  let ignoreEndProcess = false;
  let finalTranscript = '';

  recognition.continuous = true;
  recognition.interimResults = true;

  /**
   * 음성 인식 시작 처리
   */
  recognition.onstart = function () {
    console.log('onstart', arguments);
    isRecognizing = true;
    $btnMic.className = 'on';
  };

  /**
   * 음성 인식 종료 처리
   */
  recognition.onend = function () {
    console.log('onend', arguments);
    isRecognizing = false;

    if (ignoreEndProcess) {
      return false;
    }

    // DO end process
    $btnMic.className = 'off';
    if (!finalTranscript) {
      console.log('empty finalTranscript');
      return false;
    }
  };

  /**
   * 음성 인식 결과 처리
   */
  context[roomId] = '';

  socket.on('getScript', (data) => {
    for (var key in data) {
      context[key] = data[key];
    }

    let another = 0;
    for (var i in users) {
      if (userId != users[i]) {
        another = users[i];
      }
    }
    final_span.innerHTML = linebreak(context[roomId]);
    $resultWrap.scrollTop = $resultWrap.scrollHeight;
  });

  recognition.onresult = function (event) {
    console.log('onresult', event);

    let interimTranscript = '';
    if (typeof event.results === 'undefined') {
      recognition.onend = null;
      recognition.stop();
      return;
    }

    finalTranscript = context[roomId];
    if (finalTranscript == undefined) {
      finalTranscript = ''
    }
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        if (big) {
          finalTranscript += "<div>" + "<p style=font-size:30px;>" + '[' + userId + "] " + transcript + "</p>" + "<p style=font-size:20px;>" + today.toLocaleTimeString() + "</p>" + "</div>";
          big = 0;
        } else {
          finalTranscript += "<div>" + "<p style=font-size:20px;>" + '[' + userId + "] " + transcript + "</p>" + "<p style=font-size:20px;>" + today.toLocaleTimeString() + "</p>" + "</div>";
        }
      } else {
        interimTranscript += transcript;
      }
    }
    finalTranscript = capitalize(finalTranscript);
    final_span.innerHTML = linebreak(finalTranscript);
    interim_span.innerHTML = linebreak(interimTranscript);
    $resultWrap.scrollTop = $resultWrap.scrollHeight;

    context[roomId] = finalTranscript;
    context[userId] = interimTranscript;
    socket.emit('sendScript', context);

    console.log('finalTranscript', finalTranscript);
    console.log('interimTranscript', interimTranscript);
    fireCommand(interimTranscript);
  };

  /**
   * 음성 인식 에러 처리
   */
  recognition.onerror = function (event) {
    console.log('onerror', event);

    if (event.error.match(/no-speech|audio-capture|not-allowed/)) {
      ignoreEndProcess = true;
    }

    $btnMic.className = 'off';
  };

  /**
   * 명령어 처리
   * @param string
   */
  function fireCommand(string) {
    if (string.endsWith('레드')) {
      $resultWrap.className = 'red';
    } else if (string.endsWith('블루')) {
      $resultWrap.className = 'blue';
    } else if (string.endsWith('그린')) {
      $resultWrap.className = 'green';
    } else if (string.endsWith('옐로우')) {
      $resultWrap.className = 'yellow';
    } else if (string.endsWith('오렌지')) {
      $resultWrap.className = 'orange';
    } else if (string.endsWith('그레이')) {
      $resultWrap.className = 'grey';
    } else if (string.endsWith('골드')) {
      $resultWrap.className = 'gold';
    } else if (string.endsWith('화이트')) {
      $resultWrap.className = 'white';
    } else if (string.endsWith('블랙')) {
      $resultWrap.className = 'black';
    } else if (string.endsWith('알람') || string.endsWith('알 람')) {
      alert('알람');
    } else if (string.endsWith('노래 켜') || string.endsWith('음악 켜')) {
      $audio.play();
      $iconMusic.classList.add('visible');
    } else if (string.endsWith('노래 꺼') || string.endsWith('음악 꺼')) {
      $audio.pause();
      $iconMusic.classList.remove('visible');
    } else if (string.endsWith('볼륨 업') || string.endsWith('볼륨업')) {
      $audio.volume += 0.2;
    } else if (string.endsWith('볼륨 다운') || string.endsWith('볼륨다운')) {
      $audio.volume -= 0.2;
    } else if (string.endsWith('스피치') || string.endsWith('말해줘') || string.endsWith('말 해 줘')) {
      textToSpeech($('#final_span').text() || '전 음성 인식된 글자를 읽습니다.');
    }
  }

  /**
   * 개행 처리
   * @param {string} s
   */
  function linebreak(s) {
    return s;
  }

  /**
   * 첫문자를 대문자로 변환
   * @param {string} s
   */
  function capitalize(s) {
    return s.replace(FIRST_CHAR, function (m) {
      return m.toUpperCase();
    });
  }

  /**
   * 음성 인식 트리거
   */
  function start() {
    if (isRecognizing) {
      recognition.stop();
      return;
    }
    recognition.lang = language;
    recognition.start();
    ignoreEndProcess = false;

    save_data = context[roomId];
    if (save_data == undefined) {
      save_data = ''
    }

    finalTranscript = '';
    final_span.innerHTML = linebreak(save_data);
    interim_span.innerHTML = '';
  }

  /**
   * 문자를 음성으로 읽어 줍니다.
   * 지원: 크롬, 사파리, 오페라, 엣지
   */
  function textToSpeech(text) {
    console.log('textToSpeech', arguments);

    // speechSynthesis options
    // const u = new SpeechSynthesisUtterance();
    // u.text = 'Hello world';
    // u.lang = 'en-US';
    // u.rate = 1.2;
    // u.onend = function(event) {
    //   log('Finished in ' + event.elapsedTime + ' seconds.');
    // };
    // speechSynthesis.speak(u);

    // simple version
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  /**
   * 초기 설정
   */
  function initialize() {
    userId = prompt('닉네임을 입력해주세요');
    setRoomToken();
    roomId = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
    setClipboard();
    console.log("===" + roomId + "===");
    console.log("===" + userId + "===");
    // 소켓 관련 이벤트 바인딩
    socket.emit('enter', roomId, userId);
    socket.on('join', onJoin);
    socket.on('leave', onLeave);
    socket.on('message', onMessage);
    // Peer 관련 이벤트 바인딩
    peerHandler.on('addRemoteStream', onRemoteStream);

    $('#btn-start').click(function () {
      peerHandler.getUserMedia(mediaOption, onLocalStream);
    });

    $('#btn-camera').click(function () {
      const $this = $(this);
      $this.toggleClass('active');
      mediaHandler[$this.hasClass('active') ? 'pauseVideo' : 'resumeVideo']();
    });

    $('#btn-mic').click(function () {
      const $this = $(this);
      $this.toggleClass('active');
      mediaHandler[$this.hasClass('active') ? 'muteAudio' : 'unmuteAudio']();
    });

    init();
  }

  //워드 다운로드
  $('#btn-doc').click(function () {
    var header = "<html>" +
      "<head><meta charset='utf-8'></head><body>";
    var footer = "</body></html>";
    var sourceHTML = header + String(finalTranscript) + footer;

    var source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    var fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'sogumm.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  })

  //한글 다운로드
  $('#btn-hwp').click(function () {
    var header = "<html>" +
      "<head><meta charset='utf-8'></head><body>";
    var footer = "</body></html>";
    var sourceHTML = header + String(finalTranscript) + footer;

    var source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    var fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = 'sogumm.hwp';
    fileDownload.click();
    document.body.removeChild(fileDownload);
  })

  /**
   * 초기 바인딩
   */
  function initialize2() {
    const $btnTTS = document.querySelector('#btn-tts');
    const defaultMsg = '전 음성 인식된 글자를 읽습니다.';

    $btnTTS.addEventListener('click', () => {
      const text = final_span.innerText || defaultMsg;
      textToSpeech(text);
    });
    start()
    $btnMic.addEventListener('click', start);
  }

  initialize();
  initialize2();
  init2();
});

// 모션인식 관련 코드
// More API functions here:
// https://github.com/googlecreativelab/teachablemachine-community/tree/master/libraries/image

// the link to your model provided by Teachable Machine export panel
let URL = "./basic_model/";

let model, webcam, labelContainer, maxPredictions;

async function quiz() {
  if (URL == "./basic_model/") {
    URL = "./q_model/";
    init();
    quiz_btn.innerText = "End";
  } else {
    URL = "./basic_model/";
    init();
    quiz_btn.innerText = "Quiz";
  }
}

// Load the image model and setup the webcam
async function init() {
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";

  // load the model and metadata
  // Refer to tmImage.loadFromFiles() in the API to support files from a file picker
  // or files from your local hard drive
  // Note: the pose library adds "tmImage" object to your window (window.tmImage)
  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();

  // Convenience function to setup a webcam
  const flip = true; // whether to flip the webcam
  webcam = new tmImage.Webcam(200, 200, flip); // width, height, flip
  await webcam.setup(); // request access to the webcam
  await webcam.play();
  window.requestAnimationFrame(loop);

  // append elements to the DOM
  labelContainer = document.getElementById("label_container");
  // for (let i = 0; i < maxPredictions; i++) { // and class labels
  //   labelContainer.appendChild(document.createElement("div"));
  // }
}

async function loop() {
  webcam.update(); // update the webcam frame
  await predict();
  window.requestAnimationFrame(loop);
}

// run the webcam image through the image model
async function predict() {
  // predict can take in an image, video or canvas html element
  const prediction = await model.predict(webcam.canvas);
  let classPrediction = "";
  if (URL == "./q_model/") {
    if (prediction[0].probability > 0.90) {
      classPrediction = "-quiz-<br>" + "O : " + prediction[0].probability.toFixed(2);
      label_container.innerHTML = classPrediction;
    } else if (prediction[1].probability > 0.90) {
      classPrediction = "-quiz-<br>" + "X : " + prediction[1].probability.toFixed(2);
      label_container.innerHTML = classPrediction;
    } else {
      classPrediction = "-quiz-<br>" + "No Detection : " + prediction[2].probability.toFixed(2);
      label_container.innerHTML = classPrediction;
    }
  } else {
    if (prediction[0].probability > prediction[1].probability) {
      classPrediction = "-basic-<br>" + "No Detection : " + prediction[0].probability.toFixed(2);
      label_container.innerHTML = classPrediction;
    } else {
      classPrediction = "-basic-<br>" + "Hans-up : " + prediction[1].probability.toFixed(2);
      label_container.innerHTML = classPrediction;
    }
  }
  userId_p = userId + "_p";
  context[userId_p] = classPrediction;
  socket.emit('sendScript', context);
  let another = 0;
  for (var i in users) {
    if (userId != users[i]) {
      another = users[i];
    }
  }
  another_p = another + "_p";
  quiz_state.innerHTML = context[another_p];
}

// 볼륨 관련 코드

let heading = document.querySelector('h1');

function init2() {

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }


  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {

      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }



  // set up forked web audio context, for multiple browsers
  // window. is needed otherwise Safari explodes

  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var voiceSelect = document.getElementById("voice");
  var source;
  var stream;

  // grab the mute button to use below

  var mute = document.querySelector('.mute');

  //set up the different audio nodes we will use for the app

  var analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0.85;

  var distortion = audioCtx.createWaveShaper();
  var gainNode = audioCtx.createGain();
  var biquadFilter = audioCtx.createBiquadFilter();
  var convolver = audioCtx.createConvolver();

  // distortion curve for the waveshaper, thanks to Kevin Ennis
  // http://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion

  function makeDistortionCurve(amount) {
    var k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;
    for (; i < n_samples; ++i) {
      x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  // grab audio track via XHR for convolver node

  var soundSource;

  ajaxRequest = new XMLHttpRequest();

  ajaxRequest.open('GET', 'https://mdn.github.io/voice-change-o-matic/audio/concert-crowd.ogg', true);

  ajaxRequest.responseType = 'arraybuffer';


  ajaxRequest.onload = function () {
    var audioData = ajaxRequest.response;

    audioCtx.decodeAudioData(audioData, function (buffer) {
      soundSource = audioCtx.createBufferSource();
      convolver.buffer = buffer;
    }, function (e) { console.log("Error with decoding audio data" + e.err); });

    //soundSource.connect(audioCtx.destination);
    //soundSource.loop = true;
    //soundSource.start();
  };

  ajaxRequest.send();

  // set up canvas context for visualizer

  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");

  var intendedWidth = document.querySelector('.wrapper').clientWidth;

  canvas.setAttribute('width', intendedWidth);

  var visualSelect = document.getElementById("visual");

  var drawVisual;

  //main block for doing the audio recording

  if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia supported.');
    var constraints = { audio: true }
    navigator.mediaDevices.getUserMedia(constraints)
      .then(
        function (stream) {
          source = audioCtx.createMediaStreamSource(stream);
          source.connect(distortion);
          distortion.connect(biquadFilter);
          biquadFilter.connect(gainNode);
          convolver.connect(gainNode);
          gainNode.connect(analyser); // 소리 출력 안되게?!

          visualize();
          voiceChange();
        })
      .catch(function (err) { console.log('The following gUM error occured: ' + err); })
  } else {
    console.log('getUserMedia not supported on your browser!');
  }

  function visualize() {
    WIDTH = canvas.width;
    HEIGHT = canvas.height;

    var visualSetting = visualSelect.value;
    console.log(visualSetting);
    analyser.fftSize = 256;
    var bufferLengthAlt = analyser.frequencyBinCount; //시각화를 하기 위한 데이터의 갯수, 푸리에변환 절반
    console.log(bufferLengthAlt);
    var dataArrayAlt = new Uint8Array(bufferLengthAlt);//데이터를 담을 bufferLength 크기의 Unit8Array의 배열을 생성

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    var drawAlt = function () {
      drawVisual = requestAnimationFrame(drawAlt);

      analyser.getByteFrequencyData(dataArrayAlt);

      canvasCtx.fillStyle = 'rgb(245, 245, 245)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT); // 사각형 모양

      var barWidth = (WIDTH / bufferLengthAlt) * 2.5;
      var barHeight;
      var x = 0;
      var sum_height = 0;
      for (var key in dataArrayAlt) {
        sum_height += dataArrayAlt[key];
      }
      if (sum_height > 1600) {
        big = 1;
      }
      for (var i = 0; i < bufferLengthAlt; i++) {
        barHeight = dataArrayAlt[i]; // 큰 숫자 barheight         
        // if (barHeight > 200) {
        //   big = 1;
        //   // canvasCtx.fillStyle = 'rgb(255,0,0)';
        //   // $resultWrap.className = 'red';
        // }
        canvasCtx.fillStyle = 'rgb(' + (barHeight + 100) + ',50,50)';
        canvasCtx.fillRect(x, HEIGHT - barHeight / 2, barWidth, barHeight / 2); // 내부 사각형

        x += barWidth + 1; // 작은 barwidth에 1씩 증가        
      }
    };

    drawAlt();
  }

  // function voiceChange() {

  //   distortion.oversample = '4x';
  //   biquadFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0)

  //   var voiceSetting = voiceSelect.value;
  //   console.log(voiceSetting);

  //   //when convolver is selected it is connected back into the audio path
  //   if(voiceSetting == "convolver") {
  //     biquadFilter.disconnect(0);
  //     biquadFilter.connect(convolver);
  //   } else {
  //     biquadFilter.disconnect(0);
  //     biquadFilter.connect(gainNode);

  //     if(voiceSetting == "distortion") {
  //       distortion.curve = makeDistortionCurve(400);
  //     } else if(voiceSetting == "biquad") {
  //       biquadFilter.type = "lowshelf";
  //       biquadFilter.frequency.setTargetAtTime(1000, audioCtx.currentTime, 0)
  //       biquadFilter.gain.setTargetAtTime(25, audioCtx.currentTime, 0)
  //     } else if(voiceSetting == "off") {
  //       console.log("Voice settings turned off");
  //     }
  //   }
  // }

  // // event listeners to change visualize and voice settings

  visualSelect.onchange = function () {
    window.cancelAnimationFrame(drawVisual);
    visualize();
  };

  mute.onclick = voiceMute;

  function voiceMute() {
    if (mute.id === "") {
      gainNode.gain.value = 0;
      mute.id = "activated";
      mute.innerHTML = "Unmute";
    } else {
      gainNode.gain.value = 1;
      mute.id = "";
      mute.innerHTML = "Mute";
    }
  }
}