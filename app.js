var express = require("express");
var app=express();
var ejs = require('ejs');
var bodyParser = require("body-parser")
var passport = require("passport");
var LocalStrategy = require('passport-local').Strategy;
var flash = require('connect-flash-plus');

var connection = require("./modules/database");

var customerId;
var price;
var pName;
/////////////////////////////////////////////////////////

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));
app.set('view engine', 'ejs');
app.use(require('express-session')({
    secret:"sbupc",
    resave:false,
    saveUnitialized:true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());


passport.serializeUser(function(user, done) {
  customerId=user.customerID;
  done(null, user.customerID);
});

passport.deserializeUser(function(id, done) {
    connection.query("select * from Customer where customerID ="+id,function(err,rows){
            done(err, rows[0]);
    });
});

passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'getEmail',
        passwordField : 'getPwd',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(request, email, pwd, done) { // callback with email and password from our form

         connection.query("SELECT * FROM Customer WHERE `email` = '" + email + "'",function(err,rows){
            if (err)
                return done(err);
             if (!rows.length) {
                return done(null, false, request.flash('loginMessage', 'No user found.')); // req.flash is the way to set flashdata using connect-flash
            } 
            
            // if the user is found but the password is wrong
            if (!( rows[0].pwd == pwd)){
                return done(null, false, request.flash('loginMessage', 'Oops! Wrong password.')); // create the loginMessage and save it to session as flashdata
            }
            
            // all is well, return successful user
            return done(null, rows[0]);         
        
        });
}));


app.post("/login",passport.authenticate('local-login',{
    successRedirect:"/",
    failureRedirect:"/register"
    }),function(request,respon){
    
});


app.get("/logout", function(request,respon){
    request.logout();
    respon.redirect("/")
})

app.get("/",function(request,respon){
    var isLogged = request.isAuthenticated();
    respon.render("index",{isLogged:isLogged});
})

app.get("/product/:proName",function(request,respon){
    var name = request.params.proName;
    respon.render(name);
})

app.get("/register",function(request,respon){
    respon.render("register",{message: request.flash('loginMessage')});
})

app.get("/buy/:price/:proName",isLoggedIn,function(request,respon){
    price = request.params.price;
    pName = request.params.proName;
    respon.render("buy",{name:pName,price:price});
})


app.post("/singup", function(req,res)
{
    var email=req.body.getEmail;
    var pwd=req.body.getPwd;
    var firstName = req.body.getFirstName;
    var lastName = req.body.getLastName;
    var address = req.body.getAddress;
    var address2 = req.body.getAddress2;
    var city = req.body.getCity;
    var zip = req.body.getZip;
    var state = req.body.getState;
    
   turnOffAutoCommit();
    var sql = 'INSERT INTO Customer(firstName,lastName,email,pwd,address,address2,city,zipCode,state) VALUES ("'+ firstName + '","' + lastName + '","' + email 
                                    + '","' + pwd + '","' + address + '","'+address2+'","'+city+'","'+zip+'","'+state+'")';
    connection.query(sql,function (err, result) 
    {

        if (err) 
        {
            console.log("i know its duplicated, rollbacked");  //if duplicate code = ER_DUP_ENTRY
            console.log(err);
            req.flash('signupM','Sign up failed!!,try again');
            roback();
            res.render('register',{message: req.flash('signupM')});
            
        }
        else{
            console.log("1 record inserted");
            commitQuery();
            req.flash('signupM','sign success');
            res.render('register',{message: req.flash('signupM')});
        }
    });
    
})

app.post("/checkout", function(req,res){   
    //close autocommit
    turnOffAutoCommit();

    var cardNumber = req.body.getCardNumber;
    var year = req.body.getYear;
    var month = req.body.getMonth;
    var sql = 'INSERT INTO payment(cardNumber, year1, month1, price,proName) VALUES ("'+ cardNumber + '","' + year + '","' + month +'",' + price +',"'+ pName+ '")';
    connection.query(sql,function (err, result) 
    {
        if (err)    //rollback
        {
            console.log(err);  //if duplicate code = ER_DUP_ENTRY
            roback();

            res.end('Invalid message, please try it again.');
            return;
        }
        else        
        {
            console.log("1 record inserted1");
        }
    });

    connection.query("select * from payment order by paymentID desc limit 1",function(err,result){
        if(err){
            console.log(err)
        }
        else{
            var pid = result[0].paymentID;

            var firstName = req.body.getCardNumber;
            var lastName = req.body.getLastName;
            var address = req.body.getAddress;
            var state = req.body.getState;
            var city = req.body.getCity;
            var zipCode = req.body.getZipCode;
            var sql1 = 'INSERT INTO shipment(firstName, lastName, address, state, city, zipCode) VALUES ("'+ firstName + '","' + lastName + '","' + address + '","' + state + '","' + city + '","' + zipCode + '")';

            connection.query(sql1,function (err, result) 
            {
                if (err)    //rollback
                {
                    roback();
                    res.end('Invalid message, please try it again.');
                    return;
                }
                else        
                    console.log("1 record inserted2");
            });
             connection.query("select * from shipment order by shipmentID desc limit 1",function(err,result){
                    if(err){
                        console.log(err)
                    }else{
                        var sid = result[0].shipmentID;
                        console.log(pName);
                        var sql2= 'INSERT INTO OrderBy(CustomerID, PaymentID, ShipmentID, itemName) VALUES ('+ customerId + ',' + pid + ',' + sid +',"'+pName+'")';
                        connection.query(sql2,function (err, result) 
                        {
                            if (err)    //rollback
                            {
                                console.log(err);  //if duplicate code = ER_DUP_ENTRY
                                roback();
                                res.end('Invalid message, please try it again.');
                                return;
                            }
                            else        
                            {
                                console.log("1 record inserted3");

                                commitQuery();
                            }
                        });
                    }
             });
        }
    });
    res.redirect("/");
});


app.post("/search",function(request,respon){
    var searchFor=request.body.getSearch;
    var sql='SELECT itemName FROM item where itemName like "%' +searchFor +'%" OR typeOfItem like "%'+searchFor+ '%"';
    connection.query(sql,function(err,result){
        if (err)   
            console.log(err);  
        else
            respon.render("searchReturn",{result:result});  
        
    });
 
 });


app.get("/cart/:productN",isLoggedIn,function(request,res){
    var pn = request.params.productN;
    var sql0 = 'select Quantity from cart where proName ="'+pn+'" AND CustomerID='+customerId;
    turnOffAutoCommit();
    connection.query(sql0,function(err,result){
        if(err)
            console.log("i know!");
        else{
            if(result.length==0){
            var sql= 'INSERT INTO cart(CustomerID, proName) VALUES ('+ customerId + ',' + '"' + pn + '")';
                connection.query(sql,function(err,result){
                    if(err) {
                        console.log("i know!");
                         roback();
                    }
                    else{
                        console.log("inerst cart success");
                        commitQuery();
                    }
                });
            }else{
                connection.query('UPDATE cart SET Quantity = Quantity + 1 WHERE proName ="'+pn+'" AND CustomerID='+customerId,function(err,result){

                    if(err) {
                     console.log("i know!");
                     roback();
                    }
                    else{
                      console.log("update cart success");
                      commitQuery();
                    }
                });
            }
        }
    }); 

    res.redirect("/shoppingcart");

    
});

var totalprice1=0;
app.get("/shoppingcart",function(req,res){
    var sql='SELECT c.proName, c.Quantity, i.price from cart as c inner join item as i on c.proName=i.itemName where c.CustomerID='+customerId;
    connection.query(sql,function(err,result){
        if(err)    
            console.log(err);  
        else{
            var sql1 = 'select sum(total) as tp from (select Quantity*price as total from cart as c inner join item as i on c.proName = i.itemName where CustomerID = '+customerId+') as totaltable;';
            connection.query(sql1,function(err1,result1){
                if(err1)    
                    console.log(err1);  
                else{
                    if(result.length==0)
                        res.render("cart",{result:result,totalprice:0.00,message:''});
                    else{
                        totalprice1=result1[0].tp;
                        res.render("cart",{result:result,totalprice:result1[0].tp,message:''});  
                    }
                }
            });        
        }
    });

});

app.post("/updateCart/:product",function(req,res){
        var product = req.params.product;
        var quantity=req.body.getValue;
        turnOffAutoCommit();
        if(quantity>0){
        var sql = 'update cart set quantity ='+quantity+' where proName="'+product+'"'+' AND '+'CustomerID='+customerId;
        connection.query(sql,function(err,result){
            if(err){
                console.log(err)
                roback();
            }else{
                console.log("quantity set success");
            commitQuery();
            }
        })}else if(quantity==0){
            var sql = 'delete from cart where proName="'+product+'"'+' AND '+'CustomerID='+customerId;
            connection.query(sql,function(err,result){
                if(err){
                    console.log(err)
                    roback();
                }else{
                    console.log("remove set success");
                    commitQuery();
            }

            });
        }
        res.redirect('/shoppingcart');

});


app.get("/buyAll",function(request,respon){
    var sql = 'SELECT * FROM cart where CustomerID='+customerId;
    connection.query(sql,function(err, result) {
        if(err)
            console.log(err);
        else{
            if(result.length==0){
                request.flash('checkOutError','Nothing to Check Out');
                respon.render("cart",{result:'',totalprice:0.00,message: request.flash('checkOutError')}); 
            }else{
                respon.render("buyAll",{price:totalprice1});    
            }
        }
    });
});

app.post("/checkoutAll", function(req,res){   
    //close autocommit
    turnOffAutoCommit();

    var cardNumber = req.body.getCardNumber;
    var year = req.body.getYear;
    var month = req.body.getMonth;
    var sql = 'INSERT INTO payment(cardNumber, year1, month1, price,proName) VALUES ("'+ cardNumber + '","' + year + '","' + month +'",' + totalprice1 +',"'+ pName+ '")';
    connection.query(sql,function (err, result) 
    {
        if (err)    //rollback
        {
            console.log(err);  //if duplicate code = ER_DUP_ENTRY
            roback();

            res.end('Invalid message, please try it again.');
            return;
        }
        else        
        {
            console.log("1 record inserted1");
        }
    });

    connection.query("select * from payment order by paymentID desc limit 1",function(err,result){
        if(err){
            console.log(err)
        }
        else{
            var pid = result[0].paymentID;

            var firstName = req.body.getCardNumber;
            var lastName = req.body.getLastName;
            var address = req.body.getAddress;
            var state = req.body.getState;
            var city = req.body.getCity;
            var zipCode = req.body.getZipCode;
            var sql1 = 'INSERT INTO shipment(firstName, lastName, address, state, city, zipCode) VALUES ("'+ firstName + '","' + lastName + '","' + address + '","' + state + '","' + city + '","' + zipCode + '")';

            connection.query(sql1,function (err, result) 
            {
                if (err)    //rollback
                {
                    roback();
                    res.end('Invalid message, please try it again.');
                    return;
                }
                else        
                    console.log("1 record inserted2");
            });
             connection.query("select * from shipment order by shipmentID desc limit 1",function(err,result){
                    if(err){
                        console.log(err)
                    }else{
                        var sid = result[0].shipmentID;
                        var sql2= 'INSERT INTO OrderBy(CustomerID, PaymentID, ShipmentID, itemName) VALUES ('+ customerId + ',' + pid + ',' + sid +','+'"cart"'+')';
                        connection.query(sql2,function (err, result) 
                        {
                            if (err)    //rollback
                            {
                                console.log(err);  //if duplicate code = ER_DUP_ENTRY
                                roback();
                                res.end('Invalid message, please try it again.');
                                return;
                            }
                            else        
                            {
                                console.log("1 record inserted3");
                            }
                        });
                    }
             });
        }
    });
    var orderNo1 = 0;
    connection.query("SELECT OrderNo FROM OrderBy order by OrderNo desc limit 1",function(err, result) {
        if(err){
            roback();
            return;
        }else{
            orderNo1 = result[0].OrderNo;
        }
    });
    
    var sql3 = 'SELECT proName FROM cart where CustomerID = '+customerId;
    connection.query("SELECT * FROM cart",function(err,result){
        if(err){
            console.log(err);
            roback();
        }
        else{
            result.forEach(function(r){
                var sql4 = 'INSERT INTO checkCart VALUES('+orderNo1+',"'+r.proName+'")';
                connection.query(sql4,function(err, rows) {
                    if(err)
                    {
                        roback();
                        return;
                    }else{
                        console.log("order placed");
                    }
                });
            });
        }
    });
    
    var sql5 = 'DELETE FROM cart WHERE CustomerID='+customerId;
    connection.query(sql5,function(err,result){
       if(err){
           roback();
           return;
       }else{
           totalprice1=0;
           commitQuery();
       }
        
    });

    res.redirect("/");
});




//THESE ARE HELPER FUNCTIONS
    function turnOffAutoCommit(){
    var sql_close_autoCommit = "SET autocommit = 0";
    connection.query(sql_close_autoCommit,function (err, result) 
    {
        if (err) 
        {
            console.log(err);  //if duplicate code = ER_DUP_ENTRY
        }
        else
            console.log("has closed autocommit");
    });
    }


    function roback(){
        connection.query("rollback",function (err, result) 
        {
            if (err)    //rollback
                console.log(err);  //if duplicate code = ER_DUP_ENTRY
            else        
                console.log("has rolled back");
        });

    }


    function commitQuery(){

        connection.query("commit",function (err, result) 
        {
            if (err)    //rollback
                console.log(err);  //if duplicate code = ER_DUP_ENTRY
            else        
                console.log("has commited");
        });
    }


    function isLoggedIn(request,respon,next){
    if(request.isAuthenticated())
            return next();
       respon.redirect("/register");

    }

app.listen(8080, '0.0.0.0');




