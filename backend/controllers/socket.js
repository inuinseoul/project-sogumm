/**
 * Websocket handler
 * @param http
 */

//번역기 모듈
const translate = require('@vitalets/google-translate-api');
const { hi } = require('@vitalets/google-translate-api/languages');

module.exports = (http) => {
  const io = require('socket.io')(http);
  let rooms = {};
  let roomId = null;
  let socketIds = {};
  let context = {};
  let allquiz = {};
  let answers = {};
  let animations = {};
  let tts = {};

  /**
   * SocketId로 방을 탐색 합니다.
   * @param value
   * @returns {*}
   */
  function findRoomBySocketId(value) {
    const arr = Object.keys(rooms);
    let result = null;

    for (let i = 0; i < arr.length; i++) {
      if (rooms[arr[i]][value]) {
        result = arr[i];
        break;
      }
    }

    return result;
  }

  /**
   * 소켓 연결
   */
  io.on('connection', (socket) => {
    // 룸접속
    socket.on('enter', (roomName, userId) => {
      roomId = roomName;
      socket.join(roomId); // 소켓을 특정 room에 binding합니다.
      // 룸에 사용자 정보 추가, 이미 룸이 있는경우
      if (rooms[roomId]) {
        console.log('이미 룸이 있는 경우');
        rooms[roomId][socket.id] = userId;
        // 룸 생성 후 사용자 추가
      } else {
        console.log('룸 추가');
        rooms[roomId] = {};
        rooms[roomId][socket.id] = userId;
      }
      thisRoom = rooms[roomId];
      console.log('thisRoom', thisRoom);

      // 유저 정보 추가
      io.sockets.in(roomId).emit('join', roomId, thisRoom);
      //console.log('ROOM LIST', io.sockets.adapter.rooms);
      console.log('ROOM LIST', rooms);
    });

    /**
     * 메시지 핸들링
     */
    socket.on('message', (data) => {
      //console.log('message: ' + data);

      if (data.to === 'all') {
        // for broadcasting without me
        socket.broadcast.to(data.roomId).emit('message', data);
      } else {
        // for target user
        const targetSocketId = socketIds[data.to];
        if (targetSocketId) {
          io.to(targetSocketId).emit('message', data);
        }
      }
    });

    /**
     * 연결 해제 핸들링
     */
    socket.on('disconnect', () => {
      console.log('a user disconnected', socket.id);

      const roomId = findRoomBySocketId(socket.id);
      if (roomId) {
        socket.broadcast.to(roomId).emit('leave', rooms[roomId][socket.id]); // 자신 제외 룸안의 유저ID 전달
        delete rooms[roomId][socket.id]; // 해당 유저 제거
        if (Object.keys(rooms[roomId]).length == 0) {
          delete rooms[roomId];
        }
      }
    });

    socket.on('sendScript', (data) => {
      for (var key in data) {
        context[key] = data[key];
      }
      io.emit('getScript', context);
    });

    socket.on('sendQuiz', (data) => {
      for (var key in data) {
        allquiz[key] = data[key];
      }
      io.emit('getQuiz', allquiz);
    });

    socket.on('sendAnswer', (data) => {
      for (var key in data) {
        answers[key] = data[key];
      }
      io.emit('getAnswer', answers);
    });

    socket.on('sendAnimation', (data) => {
      for (var key in data) {
        animations[key] = data[key];
      }
      io.emit('getAnimation', animations);
    });

    socket.on('sendTranslate', (text, big, roomId, userId, today, highlight) => {
      let roomId_en = roomId + "_en";
      let roomId_ko = roomId + "_ko";

      if (context[roomId_en] == undefined) {
        context[roomId_en] = "";
      }
      translate(String(text), { to: 'en' }).then(res => {
        function capitalize(s) {
          return s.replace(/\S/, function (m) {
            return m.toUpperCase();
          });
        }
        if (big) {
          if (highlight) {
            context[roomId_en] += "<div>" + "<p style=\"font-size:30px; color:rgb(255, 0, 0);\">" + userId + ": " + capitalize(res.text) + "</p>" + "<p>" + today + "</p>" + "</div>";
          } else {
            context[roomId_en] += "<div>" + "<p style=\"font-size:30px;\">" + userId + ": " + capitalize(res.text) + "</p>" + "<p>" + today + "</p>" + "</div>";
          }
        } else {
          if (highlight) {
            context[roomId_en] += "<div>" + "<p style=\"color:rgb(255, 0, 0);\">" + userId + ": " + capitalize(res.text) + "</p>" + "<p>" + today + "</p>" + "</div>";
          } else {
            context[roomId_en] += "<div>" + "<p>" + userId + ": " + capitalize(res.text) + "</p>" + "<p>" + today + "</p>" + "</div>";
          }
        }
        io.emit('getScript', context);
      }).catch(err => {
        console.error(err);
      })

      if (context[roomId_ko] == undefined) {
        context[roomId_ko] = "";
      }
      translate(String(text), { to: 'ko' }).then(res => {
        if (big) {
          if (highlight) {
            context[roomId_ko] += "<div>" + "<p style=\"font-size:30px; color:rgb(255, 0, 0);\">" + userId + ": " + res.text + "</p>" + "<p>" + today + "</p>" + "</div>";
          } else {
            context[roomId_ko] += "<div>" + "<p style=\"font-size:30px;\">" + userId + ": " + res.text + "</p>" + "<p>" + today + "</p>" + "</div>";
          }
        } else {
          if (highlight) {
            context[roomId_ko] += "<div>" + "<p style=\"color:rgb(255, 0, 0);\">" + userId + ": " + res.text + "</p>" + "<p>" + today + "</p>" + "</div>";
          } else {
            context[roomId_ko] += "<div>" + "<p>" + userId + ": " + res.text + "</p>" + "<p>" + today + "</p>" + "</div>";
          }
        }
        io.emit('getScript', context);
      }).catch(err => {
        console.error(err);
      })
    });

    socket.on('sendTTS', (text, roomId, userId) => {

      if (tts[roomId] == undefined) {
        tts[roomId] = "";
      }
      tts[roomId] += userId + "," + text + ",\n";
      io.emit('getTTS', tts);
    });
  });

};
