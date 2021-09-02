// Express 기본 모듈 불러오기
const express = require('express')
	, http = require('http')
	, path = require('path');

// Express의 미들웨어 불러오기
const cookieParser = require('cookie-parser');

// 에러 핸들러 모듈 사용
const expressErrorHandler = require('express-error-handler');
var errorHandler = require('errorhandler');

// Session 미들웨어 불러오기
const expressSession = require('express-session');

// 모듈로 분리한 설정 파일 불러오기
const config = require('./config/config');

// 모듈로 분리한 데이터베이스 파일 불러오기
const database = require('./database/database');

// 클라이언트에서 ajax로 요청하면 CORS 지원
const cors = require('cors');

// 익스프레스 객체 생성
const app = express();


//===== 서버 변수 설정 및 static으로 public 폴더 설정  =====//
console.log('config.server_port : %d', config.server_port);
app.set('port', process.env.PORT || 3000);

// application/x-www-form-urlencoded 파싱
app.use(express.urlencoded({ extended: false }))

// application/json 파싱
app.use(express.json())

// public 폴더를 static으로 오픈
app.use('/public', express.static('public'));

// cookie-parser 설정
app.use(cookieParser());

// 세션 설정
app.use(expressSession({
	secret: 'my key',
	resave: true,
	saveUninitialized: true
}));

// cors를 미들웨어로 사용
app.use(cors());


//===== 404 에러 페이지 처리 =====//
var errorHandler = expressErrorHandler({
	static: {
		'404': './public/404.html'
	}
});

app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);


//===== 서버 시작 =====//

// 확인되지 않은 예외 처리 - 서버 프로세스 종료하지 않고 유지함
process.on('uncaughtException', function (err) {
	console.log('uncaughtException 발생함 : ' + err);
	console.log('서버 프로세스 종료하지 않고 유지함.');

	console.log(err.stack);
});

// 프로세스 종료 시에 데이터베이스 연결 해제
process.on('SIGTERM', function () {
	console.log("프로세스가 종료됩니다.");
	app.close();
});

app.on('close', function () {
	console.log("Express 서버 객체가 종료됩니다.");
	if (database.db) {
		database.db.close();
	}
});

// 시작된 서버 객체를 리턴 
var server = http.createServer(app).listen(app.get('port'), function () {
	console.log('서버가 시작!. 포트 : ' + app.get('port'));

	// 데이터베이스 초기화
	database.init(app, config);
});

// scoket.io 서버 시작
var io = require('socket.io')(server);
console.log('socket.io 서버 시작!');

// 로그인 아이디 매핑 (로그인 ID -> 소켓 ID)
var login_ids = {};

// 클라이언트가 연결했을 때 이벤트 처리
io.on('connection', function (socket) {
	console.log('connection info : ', socket.request.connection._peername);

	// 소켓 객체에 클라이언트 Host, Port 정보 속성으로 추가
	socket.remoteAddress = socket.request.connection._peername.address;
	socket.remotePort = socket.request.connection._peername.port;

	// login 이벤트 처리
	socket.on('login', function (login) {

		database.UserModel.find({ "id": login.id }, function (err, result) {
			if (err) {
				callback(err, null);
				return;
			}

			if (result.length > 0) {
				console.log('아이디가 이미 있음!');

				socket.emit('againlogin');
			} else {
				console.log('login 시작!');
				console.dir(login);

				// 기존 클라이언트 ID가 없으면 클라이언트 ID를 맵에 추가
				console.log('접속한 소켓의 ID : ' + socket.id);
				login_ids[login.id] = socket.id;
				socket.login_id = login.id;

				// 중복 체크
				var checkId = Object.keys(login_ids);
				io.emit('checkuser', checkId);

				console.log('접속한 클라이언트 ID 갯수 : %d', Object.keys(login_ids).length);

				// 아이디 없으면 로그인하고 DB에 아이디 저장
				var newUser = new database.UserModel({
					id: login.id
				})

				newUser.save(function (err) {
					if (err) {
						return err;
					}
				})

				console.log('채팅 시작!');

				// 응답 메시지 전송
				sendResponse(socket, '로그인 완료!');
			}
		})
	});

	// logout 이벤트 처리
	socket.on('logout', function (loginid) {
		console.dir(loginid);

		database.UserModel.remove({ id: loginid }, function (err) {
			if (err) {
				callback(err, null);
				return;
			}

			database.UserModel.find({}, function (err, result) {
				if (err) {
					callback(err, null);
					return;
				}

				// 로그아웃 유저 있을 경우 기존 유저에게 새로고침
				var checkId = [];
				for (var i = 0; i < result.length; i++) {
					checkId.push(result[i].id);
				}
				io.emit('checkuser', checkId);
			});

			// 소켓id 삭제 -> 유저리스트에 안보임
			delete login_ids[loginid];
			console.log('데이터 삭제 - 로그아웃 완료!');
			socket.emit('completedlogout');
		})
	})

	// message 이벤트 처리
	socket.on('message', function (message) {
		console.log('message 받음!');
		console.dir(message);


		// command 속성으로 채팅 유형 구별
		if (message.command == 'chat') { // 귓속말
			if (login_ids[message.recepient]) {
				io.of("/").sockets.get(login_ids[message.recepient]).emit('message', message);
				sendResponse(socket, '메시지 전송!');
			} else {
				sendResponse(socket, '상대방이 없음!');
				socket.emit('nouser');
			}
		} else if (message.command == 'groupchat') { // 단체 채팅
			console.dir('모든 클라이언트에게 message 전송!');
			socket.broadcast.emit('message', message);
		}

	});
});

// 응답 메시지 전송 메소드
function sendResponse(socket, message) {
	var statusObj = { message: message };
	socket.emit('response', statusObj);
}