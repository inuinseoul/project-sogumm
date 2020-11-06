/**
 * Websocket handler
 * @param http
 */

//번역기 모듈
const translate = require('@vitalets/google-translate-api');

module.exports = (http) => {
  const io = require('socket.io')(http);
  let rooms = {};
  let roomId = null;
  let socketIds = {};
  let context = {};
  let allquiz = {};
  let answers = {};

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
      //영어로 번역
      if (data['translate'] == 'English')
        translate(String(data[roomId]), {to:'en'}).then(res => {
        context[roomId] = res.text;
        console.log(context)
        io.emit('getScript', context);
        }).catch(err => {
          console.error(err);
        })
        
      //한글로 번역
      else if (data['translate'] != 'English'){
        context[roomId] = data[roomId];
        console.log(data)
        io.emit('getScript', context);
      }
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
  });
};

