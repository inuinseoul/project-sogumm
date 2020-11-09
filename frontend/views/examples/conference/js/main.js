/*!
 *
 * 후동이 소금구이
 * 박인우, 이형석, 김주영, 이소현
 *
 */
let highlight = 0;
let big = 0;
let context = {};
let allquiz = {};
let answers = {};
const socket = io();
let userId;
let remoteUserId;
let users = [];
let translate = 0;
const mediaHandler = new MediaHandler();

$(function () {
  console.log('Loaded Main');

  let isOffer;
  let roomId;

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

    $('#btn-join').click(function () {
      isOffer = true;
      peerHandler.getUserMedia(mediaOption, onLocalStream, isOffer);
      $(this).attr('disabled', true);

      $btnMic.addEventListener('click', start);

      $('#btn-camera').click(function () {
        const $this = $(this);
        $this.toggleClass('active');
        mediaHandler[$this.hasClass('active') ? 'pauseVideo' : 'resumeVideo']();
      });

      $('#btn-lang').click(function () {
        if (translate == 1) {
          translate = 0;
        } else {
          translate = 1;
        }
        socket.emit('sendScript', context);
      });

      init();
      start();
      $('#btn-camera').toggleClass('active');
      quiz_text.innerHTML = remoteUserId + "님과 연결되었습니다.";
      console.log("ddds====ssdsd===");
      $('#btn-join').off();
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
    quiz_text.innerHTML = "일부 사용자가 회의를 이탈했습니다.";
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
      // 기존 방에 들어간 경우
      $uniqueToken.attr('href', location.href);
      roomId = location.href;
    } else {
      // 내방을 만든 경우
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
    quiz_text.innerHTML = remoteUserId + "님과 연결되었습니다.";

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
    let roomId_en = roomId + "_en";
    if (translate) {
      if (final_span.innerHTML != context[roomId_en]) {
        final_span.innerHTML = context[roomId_en];
      }
    } else {
      if (final_span.innerHTML != capitalize(context[roomId])) {
        final_span.innerHTML = capitalize(context[roomId]);
      }
    }
    interim_span.innerHTML = linebreak(context[remoteUserId]);
    $resultWrap.scrollTop = $resultWrap.scrollHeight;
  });

  socket.on('getQuiz', (data) => {
    for (var key in data) {
      allquiz[key] = data[key];
    }
  });

  socket.on('getAnswer', (data) => {
    for (var key in data) {
      answers[key] = data[key];
    }
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
      finalTranscript = '';
    }
    let check_talk = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      let transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        let today = new Date();
        socket.emit('sendTranslate', transcript, big, roomId, userId, today.toLocaleTimeString());

        if (transcript.endsWith('레드')) {
          if (highlight == 1) {
            highlight = 0;
          }
          else {
            highlight = 1;
          }
        }

        if (big) {
          if (highlight == 1) {
            let now_chat = "<div>" + "<p style=\"font-size:30px; color:rgb(255, 0, 0)\">" + '[' + userId + "] " + transcript + "</p>" + "<p style=\"font-size:20px; color:rgb(255, 0, 0)\">" + today.toLocaleTimeString() + "</p>" + "</div>";
            finalTranscript += now_chat;
            final_span.append(now_chat)
            big = 0;
          }

          else {
            if (transcript.endsWith('레드')) {
              let now_chat = "<div>" + "<p style=\"font-size:30px; color:rgb(255, 0, 0)\">" + '[' + userId + "] " + transcript + "</p>" + "<p style=\"font-size:20px; color:rgb(255, 0, 0)\">" + today.toLocaleTimeString() + "</p>" + "</div>";
              finalTranscript += now_chat;
              final_span.append(now_chat)
              big = 0;
            }
            else {
              let now_chat = "<div>" + "<p style=\"font-size:30px;\">" + '[' + userId + "] " + transcript + "</p>" + "<p style=\"font-size:20px;\">" + today.toLocaleTimeString() + "</p>" + "</div>";
              finalTranscript += now_chat;
              final_span.append(now_chat)
              big = 0;
            }
          }
        }
        else {
          if (highlight == 1) {
            let now_chat = "<div>" + "<p style=\"font-size:20px; color:rgb(255, 0, 0)\">" + '[' + userId + "] " + transcript + "</p>" + "<p style=\"font-size:20px; color:rgb(255, 0, 0)\">" + today.toLocaleTimeString() + "</p>" + "</div>";
            finalTranscript += now_chat;
            final_span.append(now_chat)
          }

          else {
            if (transcript.endsWith('레드')) {
              let now_chat = "<div>" + "<p style=\"font-size:20px; color:rgb(255, 0, 0)\">" + '[' + userId + "] " + transcript + "</p>" + "<p style=\"font-size:20px; color:rgb(255, 0, 0)\">" + today.toLocaleTimeString() + "</p>" + "</div>";
              finalTranscript += now_chat;
              final_span.append(now_chat)
            }

            else {
              let now_chat = "<div>" + "<p style=\"font-size:20px; \">" + '[' + userId + "] " + transcript + "</p>" + "<p style=\"font-size:20px;\">" + today.toLocaleTimeString() + "</p>" + "</div>";
              finalTranscript += now_chat;
              final_span.append(now_chat)
            }
          }
        }
      }
      else {
        interimTranscript += transcript;
      }
      check_talk = transcript;
    }
    finalTranscript = capitalize(finalTranscript);
    my_interim_span.innerHTML = linebreak(interimTranscript);
    $resultWrap.scrollTop = $resultWrap.scrollHeight;

    context[roomId] = finalTranscript;
    context[userId] = interimTranscript;
    socket.emit('sendScript', context);

    let roomId_en = roomId + "_en";
    console.log('finalTranscript', finalTranscript);
    console.log('final_english', context[roomId_en]);
    console.log('interimTranscript', interimTranscript);
    fireCommand(check_talk);
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
    if (string.endsWith('OX 퀴즈 시작')) {
      if (URL == "./a_model/") {
        URL = "./q_model/";
        init();
        quiz_text.innerHTML = "퀴즈 출제중! 마감하려면 'OX 퀴즈 종료'라고 말하세요.";
        let userId_qi = userId + "_qi";
        let userId_qc = userId + "_qc";
        allquiz[userId_qi] = prompt('퀴즈 내용을 입력해주세요');
        while ((allquiz[userId_qi] == null) || (allquiz[userId_qi] == "")) {
          allquiz[userId_qi] = prompt('퀴즈 내용을 입력해주세요 (최소 한글자를 입력해야 합니다.)');
        }
        allquiz[userId_qc] = prompt('퀴즈 정답을 입력해주세요(O/X)');
        while ((allquiz[userId_qc] != "O") && (allquiz[userId_qc] != "o") && (allquiz[userId_qc] != "X") && (allquiz[userId_qc] != "x")) {
          allquiz[userId_qc] = prompt('퀴즈 정답을 입력해주세요 (O 또는 X로 입력해야 합니다.)');
        }
        socket.emit('sendQuiz', allquiz);
      }
    } else if (string.endsWith('OX 퀴즈 종료')) {
      if (URL == "./q_model/") {
        URL = "./a_model/";
        init();
        let userId_qi = userId + "_qi";
        let userId_qc = userId + "_qc";
        allquiz[userId_qi] = null;
        socket.emit('sendQuiz', allquiz);
        let remoteUserId_p = remoteUserId + "_p";
        if ((allquiz[userId_qc] == 'O') || (allquiz[userId_qc] == 'o')) {
          if (answers[remoteUserId_p] == 'O') {
            quiz_text.innerHTML = "상대방이 정답을 맞췄습니다!";
          } else if (answers[remoteUserId_p] == 'X') {
            quiz_text.innerHTML = "상대방이 정답을 맞추지 못했네요.";
          } else {
            quiz_text.innerHTML = "상대방의 동작이 제대로 인식되지 못한 것 같아요.";
          }
        } else if ((allquiz[userId_qc] == 'X') || (allquiz[userId_qc] == 'x')) {
          if (answers[remoteUserId_p] == 'X') {
            quiz_text.innerHTML = "상대방이 정답을 맞췄습니다!";
          } else if (answers[remoteUserId_p] == 'O') {
            quiz_text.innerHTML = "상대방이 정답을 맞추지 못했네요.";
          } else {
            quiz_text.innerHTML = "상대방이 없거나 상대방의 동작이 제대로 인식되지 못한 것 같아요.";
          }
        } else {
          quiz_text.innerHTML = "퀴즈의 정답을 제대로 입력하지 않은 것 같아요. (O/X)";
        }
      }
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
    socket.emit('sendScript', context);
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
    while ((userId == null) || (userId == "")) {
      userId = prompt('닉네임을 입력해주세요 (최소 한글자를 입력해야합니다.)');
    }
    let check = 0;

    // 소켓 관련 이벤트 바인딩
    socket.on('join', onJoin);
    socket.on('leave', onLeave);
    socket.on('message', onMessage);
    // Peer 관련 이벤트 바인딩
    peerHandler.on('addRemoteStream', onRemoteStream);

    if (location.hash.length > 2) {
      $waitWrap.html(
        [
          '<div class="video_msg room-info">',
          '<p class="sg_black fc-td">아래 버튼을 눌러<br />온라인 미팅에 참여할 수 있습니다</p>',
          '<p id="btn-join" class="video_btn">JOIN</p>',
          '</div>',
        ].join('\n')
      );
      setRoomToken();
      roomId = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
      setClipboard();
      socket.emit('enter', roomId, userId);
    } else {
      check = 1;
      $createWrap.html(
        [
          '<div class="video_msg">',
          '<p class="sg_black fc-td">아래 버튼을 눌러<br />온라인 미팅을 시작할 수 있습니다</p>',
          '<p id="btn-start" class="video_btn">START</p>',
          '</div>',
        ].join('\n')
      );
    }

    $('#btn-start').click(function () {
      if (check) {
        setRoomToken();
        roomId = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
        setClipboard();
        socket.emit('enter', roomId, userId);
      }
      peerHandler.getUserMedia(mediaOption, onLocalStream);
      quiz_text.innerHTML = "방 링크를 공유해서 상대방과 만나보세요!";

      $btnMic.addEventListener('click', start);

      $('#btn-camera').click(function () {
        const $this = $(this);
        $this.toggleClass('active');
        mediaHandler[$this.hasClass('active') ? 'pauseVideo' : 'resumeVideo']();
      });

      $('#btn-lang').click(function () {
        if (translate == 1) {
          translate = 0;
        } else {
          translate = 1;
        }
        socket.emit('sendScript', context);
      });

      init();

      $('#btn-start').off();
      start();
      $('#btn-camera').toggleClass('active');
    });


  }

  //워드 다운로드
  $('#btn-doc').click(function () {
    var header = "<html>" +
      "<head><meta charset='utf-8'></head><body>";
    var footer = "</body></html>";
    var sourceHTML = header + String(final_span.innerHTML) + footer;

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
    var sourceHTML = header + String(final_span.innerHTML) + footer;

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

  }

  initialize();
  initialize2();
  init2();
});

// 모션인식 관련 코드
let URL = "./a_model/";

let model, webcam, labelContainer, maxPredictions;

// Load the image model and setup the webcam
async function init() {
  const modelURL = URL + "model.json";
  const metadataURL = URL + "metadata.json";

  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();

  const flip = true;
  webcam = new tmImage.Webcam(200, 200, flip);
  await webcam.setup();
  await webcam.play();
  window.requestAnimationFrame(loop);
}

async function loop() {
  webcam.update(); // update the webcam frame
  if (URL == "./q_model/") {
    await predict();
  } else if (URL == "./a_model/") {
    await predict2();
  }
  window.requestAnimationFrame(loop);
}

async function predict() {
  const prediction = await model.predict(webcam.canvas);
  let classPrediction = "";
  let remoteUserId_qi = remoteUserId + "_qi";
  let remoteUserId_qc = remoteUserId + "_qc";
  if (allquiz[remoteUserId_qi]) {
    quiz_text.innerHTML = '"' + allquiz[remoteUserId_qi] + '"';
    if (prediction[0].probability > 0.60) {
      classPrediction = "O";
      quiz_motion.innerHTML = '의 정답은?  ' + "<strong>" + classPrediction + "</strong>";
    } else if (prediction[1].probability > 0.60) {
      classPrediction = "X";
      quiz_motion.innerHTML = '의 정답은?  ' + "<strong>" + classPrediction + "</strong>";
    } else {
      classPrediction = "No Detection : <strong>" + prediction[2].probability.toFixed(2) + "</strong>";
      quiz_motion.innerHTML = classPrediction;
    }
  } else {
    if (allquiz[remoteUserId_qc]) {
      if (allquiz[remoteUserId_qc] == 'o' || allquiz[remoteUserId_qc] == 'O') {
        if (quiz_motion.innerHTML == "의 정답은?  <strong>O</strong>") {
          quiz_text.innerHTML = "정답을 맞추셨습니다!";
        } else {
          quiz_text.innerHTML = "틀렸습니다. 정답은 O였습니다.";
        }
      } else if (allquiz[remoteUserId_qc] == 'x' || allquiz[remoteUserId_qc] == 'X') {
        console.log(quiz_motion.innerHTML);
        if (quiz_motion.innerHTML == "의 정답은?  <strong>X</strong>") {
          quiz_text.innerHTML = "정답을 맞추셨습니다!";
        } else {
          quiz_text.innerHTML = "틀렸습니다. 정답은 X였습니다.";
        }
      }
      allquiz[remoteUserId_qc] = null;
      socket.emit('sendQuiz', allquiz);
    }
    if (quiz_motion.innerHTML != "") {
      quiz_motion.innerHTML = "";
    }
  }
  userId_p = userId + "_p";
  answers[userId_p] = classPrediction;
  socket.emit('sendAnswer', answers);
}

async function predict2() {
  const prediction = await model.predict(webcam.canvas);
  let remoteUserId_a = remoteUserId + "_a";
  let userId_a = userId + "_a";
  if (prediction[0].probability > prediction[1].probability) {
    quiz_text.innerHTML = "어서오세요. " + userId + "님!";
    $('#btn-camera').removeClass('active');
    mediaHandler[$('#btn-camera').hasClass('active') ? 'pauseVideo' : 'resumeVideo']();
    allquiz[userId_a] = 0;
    if (allquiz[remoteUserId_a]) {
      quiz_text.innerHTML = remoteUserId + "님이 자리를 비우셨어요.";
    }
  } else if (prediction[1].probability > prediction[0].probability) {
    quiz_text.innerHTML = "자리를 이탈하셔서 자동으로 카메라를 닫습니다.";
    $('#btn-camera').addClass('active');
    mediaHandler[$('#btn-camera').hasClass('active') ? 'pauseVideo' : 'resumeVideo']();
    allquiz[userId_a] = 1;
  }
  socket.emit('sendQuiz', allquiz);
}

// 볼륨 관련 코드

function init2() {

  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {

      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }

  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var voiceSelect = document.getElementById("voice");
  var source;
  var stream;

  var analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = 0;
  analyser.smoothingTimeConstant = 0.85;

  var distortion = audioCtx.createWaveShaper();
  var gainNode = audioCtx.createGain();
  var biquadFilter = audioCtx.createBiquadFilter();
  var convolver = audioCtx.createConvolver();

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

  };

  ajaxRequest.send();

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
          gainNode.connect(analyser);

          visualize();
        })
      .catch(function (err) { console.log('The following gUM error occured: ' + err); })
  } else {
    console.log('getUserMedia not supported on your browser!');
  }

  function visualize() {

    analyser.fftSize = 256;
    var bufferLengthAlt = analyser.frequencyBinCount; //시각화를 하기 위한 데이터의 갯수, 푸리에변환 절반
    console.log(bufferLengthAlt);
    var dataArrayAlt = new Uint8Array(bufferLengthAlt);//데이터를 담을 bufferLength 크기의 Unit8Array의 배열을 생성

    var drawAlt = function () {
      analyser.getByteFrequencyData(dataArrayAlt);

      var sum_height = 0;
      for (var key in dataArrayAlt) {
        sum_height += dataArrayAlt[key];
      }
      if (sum_height > 1600) {
        big = 1;
      }
    };

    timerId = setInterval(drawAlt, 5);
  }

}