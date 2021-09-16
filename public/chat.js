var host;
var port;
var socket;

// 문서 로딩 후 실행
$(function () {

    $("#connectButton").bind('click', function (event) {
        document.all.idInput.style.display = "none";
        document.all.connectButton.style.display = "none";
        document.all.logoutButton.style.display = "";

        // 서버 연결
        println('연결 완료!');

        host = 'localhost';
        port = '3000';

        connectToServer();

        // 로그인 처리
        var id = $('#idInput').val();

        if (checkSpace(id) == true || id == "" || checkSpecial(id)) {
            alert('공백이나 특수문자를 사용할 수 없음!');
            location.href = '';
        } else if (id.length > 10) {
            alert('10자 미만으로 해줘!');
            location.href = '';
        }

        var output = { id: id };
        console.log('서버로 보낼 데이터 : ' + JSON.stringify(output));

        if (socket == undefined) {
            alert('서버에 연결되어 있지 않음!');
            return;
        }

        // 아이디가 존재할 경우 다시 로그인 이벤트 발생
        socket.on('againlogin', function () {
            alert('아이디가 이미 있음!');
            location.href = '';
        })

        socket.emit('login', output);

        socket.on('checkuser', function (checkId) {
            $(".users").html('');
            for (var i = 0; i < checkId.length; i++) {
                addUserlist(checkId[i]);
            }
        })

        // 음성 => 텍스트 채팅
        if (!("webkitSpeechRecognition" in window)) {
            alert("음성채팅 기능은 크롬만 지원함!");
        } else {
            const speech = new webkitSpeechRecognition;

            document.getElementById("start").addEventListener("click", () => {
                speech.start();
            })

            document.getElementById("stop").addEventListener("click", () => {
                speech.stop();
            })

            // 단축키 지정
            document.onkeyup = (e) => {
                if(e.which == 89) speech.start(); // 단축키 : Y
                if(e.which == 85) speech.stop(); // 단축키 : U
            }

            speech.addEventListener("result", (event) => {
                const { transcript } = event["results"][0][0];
                
                // chattype 구별
                var chattype = $('#chattype option:selected').val();

                var sender = $('#idInput').val();
                var recepient = $('#recepientInput').val();
                var data = transcript;

                var output = { sender: sender, recepient: recepient, command: chattype, type: 'text', data: data };
                console.log('서버로 보낼 데이터 : ' + JSON.stringify(output));

                if (socket == undefined) {
                    alert('서버가 연결되어 있지 않음!');
                    return;
                }

                socket.emit('message', output);

                addToDiscussion('self', sender, recepient, chattype, data);
            })
        }
    });

    // 로그아웃 - 채팅서버 연결 끊기
    $("#logoutButton").bind('click', function (event) {
        connectToServer();
        var id = $('#idInput').val();

        socket.emit('logout', id);

        println('로그아웃!');

        socket.on('checkuser', function (checkId) {
            $(".users").html('');
            for (var i = 0; i < checkId.length; i++) {
                addUserlist(checkId[i]);
            }
        })

        socket.on('completedlogout', function () {
            location.href = '';
        })
    })

    // chattype에 따라 input창 보여주기
    $("#chattype").on('change', function (event) {
        var selected = $("option:selected", this).text();

        if (selected == "귓속말") {
            document.all.whorecepient.style.display = "";
        } else {
            document.all.whorecepient.style.display = "none";
            document.getElementById("recepientInput").value = "ALL";
        }
    });

    // 전송 처리
    $("#sendButton").bind('click', function (event) {
        // chattype 구별
        var chattype = $('#chattype option:selected').val();

        var sender = $('#idInput').val();
        var recepient = $('#recepientInput').val();
        var data = $('#dataInput').val();

        var output = { sender: sender, recepient: recepient, command: chattype, type: 'text', data: data };
        console.log('서버로 보낼 데이터 : ' + JSON.stringify(output));

        if (socket == undefined) {
            alert('서버가 연결되어 있지 않음!');
            return;
        }

        socket.emit('message', output);

        addToDiscussion('self', sender, recepient, chattype, data);

        // 메시지창 초기화
        data = $('#dataInput').val('');
    });

});

// 서버에 연결하는 함수 정의
function connectToServer() {

    var options = { 'forceNew': true };
    var url = 'http://' + host + ':' + port;
    socket = io.connect(url, options);

    socket.on('connect', function () {

        socket.on('message', function (message) {
            console.log(JSON.stringify(message));

            println('<p>' + message.sender + ' : ' + message.data + '</p>');
            addToDiscussion('other', message.sender, message.recepient, message.command, message.data);
        });

    });

    socket.on('response', function (response) {
        console.log(JSON.stringify(response));
        println(response.message);
    });

    socket.on('disconnect', function () {
        println('웹소켓 연결이 종료!');
    });

}

function println(data) {
    console.log(data);
    $('#result').append('<p>' + data + '</p>');
}

function addToDiscussion(writer, sender, rcp, cmd, msg) {
    var img = './images/self.png';
    if (writer == 'other') {
        img = './images/unknown.png';
    }

    // 현재 시간 출력
    var date = new Date();
    var hour = date.getHours();
    var min = date.getMinutes();
    if (min < 10) {
        min = "0" + min;
    }
    var time = hour + ":" + min;

    // 사용자 존재하지 않을 경우 알려주기
    socket.on('nouser', function() {
        alert('사용자가 없음!');
    });

    if (cmd == "groupchat") {
        var contents = "<li class='" + writer + "'>"
        + "  <div class='chat-avatar'>"
        + "    <img src='" + img + "' alt='Retail Admin'/>"
        + "    <div class='chat-name'>" + sender + "</div>"
        + "  </div>"
        + "  <div class='chat-text'>" + msg + "</div>"
        + "  <div class='chat-hour'>" + time + "</div>"
        + "</li>";
    } else if (cmd == "chat" && writer != "other") { // 귓속말 일때 전체채팅과는 색깔 다르게 구분 (보내는 사람)
        var contents = "<li class='" + writer + "'>"
        + "  <div class='chat-avatar'>"
        + "    <img src='" + img + "' alt='Retail Admin'/>"
        + "    <div class='chat-name'>" + sender + "</div>"
        + "  </div>"
        + "  <div class='chat-text2'>" + "To : " + rcp + "   >>>   " + msg + "</div>"
        + "  <div class='chat-hour'>" + time + "</div>"
        + "</li>";
    } else if (cmd == "chat" && writer == "other") { // 귓속말 일때 전체채팅과는 색깔 다르게 구분 (받는 사람)
        var contents = "<li class='" + writer + "'>"
        + "  <div class='chat-avatar'>"
        + "    <img src='" + img + "' alt='Retail Admin'/>"
        + "    <div class='chat-name'>" + sender + "</div>"
        + "  </div>"
        + "  <div class='chat-text2'>" + "From : " + sender + "   >>>   " + msg + "</div>"
        + "  <div class='chat-hour'>" + time + "</div>"
        + "</li>";
    }

    $(".chat-box").append(contents);
    $(".chat-box").scrollTop($(".chat-box").prop("scrollHeight"));
}

// 로그인 후 유저 리스트에 프로필 추가
function addUserlist(id) {
    var img = "./images/unknown.png";

    var userprofile = "<li class='person' data-chat='person1'>"
        + "  <div class='user'>"
        + "    <img src='" + img + "' alt='Retail Admin'>"
        + "  </div>"
        + "  <p class='name-time'>"
        + "    <span class='name'>" + id + "</span>"
        + "  </p>"
        + "</li>"

    $(".users").append(userprofile);
}

// 공백 체크
function checkSpace(str) {
    if (str.search(/\s/) != -1) {
        return true;
    } else {
        return false;
    }
}

// 특수 문자 체크
function checkSpecial(str) {
    var special_pattern = /[`~!@#$%^&*|\\\'\";:\/?]/gi;

    if (special_pattern.test(str) == true) {
        return true;
    } else {
        return false;
    }
}