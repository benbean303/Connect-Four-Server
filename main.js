var rooms = [];

var server = require('http').createServer();
var io = require('socket.io')(server);
var socketObj;

function Room (name) {
	this.name = name;
	this.currentTurn = Math.round (Math.random ());
	this.full = false;
	this.pings = [0];
	
	this.board = new Array(6);
	for (i = 0; i < this.board.length; i++) {
		this.board[i] = new Array (7);
	}
}

function startGame (roomName) {
	 var currentTurn = 0;
	 rooms[Number(roomName)].currentTurn = currentTurn;
	 
	 io.to (roomName).emit ('startGame', currentTurn);
}

function findRoom (name) {
	for (i = 0; i < rooms.length; i++) {
		if (rooms[i].name == name)
			return rooms[i];
	}
}

function addToBoard (position, room, id) {
	var board = room.board;
	
	for (i = 5; i < board.length; i--) {
		if (!board[i])
			return;

		if (board[i][position - 1] === undefined) {
			board[i][position - 1] = id + 1;
			
			var winner = checkWin (board);
			if (winner !== false) {
				io.to (room.name).emit ('gameover', winner);
				rooms.splice(Number(room.name), 1);
			}
				
			return true;
		}
	}
	
	return false;
}

function checkLine (a, b, c, d) {
	return ((a) && (a == b) && (a == c) && (a == d));
}

function checkWin (bd) {
	// Check down
    for (r = 0; r < 3; r++)
        for (c = 0; c < 7; c++)
            if (checkLine(bd[r][c], bd[r+1][c], bd[r+2][c], bd[r+3][c]))
                return bd[r][c] - 1;

    // Check right
    for (r = 0; r < 6; r++)
        for (c = 0; c < 4; c++)
            if (checkLine(bd[r][c], bd[r][c+1], bd[r][c+2], bd[r][c+3]))
                return bd[r][c] - 1;

    // Check down-right
    for (r = 0; r < 3; r++)
        for (c = 0; c < 4; c++)
            if (checkLine(bd[r][c], bd[r+1][c+1], bd[r+2][c+2], bd[r+3][c+3]))
                return bd[r][c] - 1;

    // Check down-left
    for (r = 3; r < 6; r++)
        for (c = 0; c < 4; c++)
            if (checkLine(bd[r][c], bd[r-1][c+1], bd[r-2][c+2], bd[r-3][c+3]))
                return bd[r][c] - 1;

    return false;
}

function genPlayerID () {
    var text = " ";

    var charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for( var i=0; i < 4; i++ )
        text += charset.charAt(Math.floor(Math.random() * charset.length));

    for (j = 0; j < rooms.length; j++) {
    	if (text == rooms[j].code)
    		genRoomCode ();
    }

    return text;
}

io.sockets.on('connection', function (socket) {

	socket.on ('ping', function (data) {
		if (rooms[data.room])
			rooms[data.room].pings[data.pos] = 0;
	});

	socket.on ('placeToken', function (data) {
		var room = findRoom (data.room);

		if (!room)
			return; 

		var turn = room.currentTurn;
		
		if (data.id == turn) {
			if (addToBoard (data.position, room, data.id)) {
				io.to (room.name).emit ('tokenPlaced', {position: data.position, id: data.id, board: room.board});
				console.log (data);
				room.currentTurn = (turn + 1) % 2;
			}
		}
	});

	socket.on ('findGame', function () {
		var createRoom = true;

		for (i = 0; i < rooms.length; i++) {
			if (!rooms[i].full) {
				socket.join (rooms[i].name);
				rooms[i].full = true;
				rooms[i].pings.push (0);
				socket.emit ('id', {id: genPlayerID (), color: 'Red', room: rooms[i].name, full: true, board: rooms[i].board});
				console.log ('Player has joined room ' + rooms[i].name);
				startGame (rooms[i].name);
				createRoom = false;
			}
		}

		if (createRoom) {
			rooms.push (new Room (rooms.length));
			socket.join ((rooms.length - 1).toString ());
			socket.emit ('id', {id: genPlayerID (), color: 'Black', room: rooms.length - 1, full: false, board: rooms[rooms.length - 1].board});
			console.log ('Player has created room ' + Number(rooms.length - 1));
		}
	});
});

setInterval (function () {
	for (i = 0; i < rooms.length; i++) {
		rooms[i].pings[0] += 1;
		rooms[i].pings[1] += 1;

		if (rooms[i].pings[0] > 30) {
			io.to (rooms[i].name).emit ('disconnect', 0);
			console.log ('Player ' + 0 + " from room " + rooms[i].name + ' has disconnected.');
			rooms.splice(i, 1);
			return;
		}

		if (rooms[i].pings[1] > 30) {
			io.to (rooms[i].name).emit ('disconnect', 1);
			console.log ('Player ' + 1 + " from room " + rooms[i].name + ' has disconnected.');
			rooms.splice(i, 1);
		}
	}
}, 1000);

server.listen(3000);
console.log ('Server started.');