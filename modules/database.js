var mysql = require('mysql');
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'hqzhu',
  password : 'hqzhu0132',
  database : 'sbupc'
});
connection.connect(function(err) 
{
  if (err) 
    console.log(err);
  else
    console.log("Connected!");
});

module.exports = connection;