var Schema = {};

Schema.createSchema = function(mongoose) {
	
	// 스키마 정의
	var UserSchema = mongoose.Schema({
		id: {type: String, required: true, unique: true}
	});
	
	// 입력된 칼럼의 값이 있는지 확인
	UserSchema.path('id').validate(function (id) {
		return id.length;
	}, 'id 칼럼의 값이 없습니다.');	
	
	// 모델 객체에서 사용할 수 있는 메소드 정의
	UserSchema.static('findById', function(id, callback) {
		return this.find({id:id}, callback);
	});
	
	UserSchema.static('findAll', function(callback) {
		return this.find({}, callback);
	});
	
	console.log('UserSchema 정의!');

	return UserSchema;
};

// module.exports에 UserSchema 객체 직접 할당
module.exports = Schema;