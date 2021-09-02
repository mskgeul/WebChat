module.exports = {
	server_port: 3000,
	db_url: 'mongodb://localhost:27017/local',
	db_schemas: [
	    {file:'./user_schema', collection:'chat', schemaName:'UserSchema', modelName:'UserModel'}
	],
	route_info: [
	]
}