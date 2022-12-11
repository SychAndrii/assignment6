/*********************************************************************************
* BTI325 – Assignment 5
* I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part
* of this assignment has been copied manually or electronically from any other source
* (including 3rd party web sites) or distributed to other students.
*
* Name: Andrii Sych Student ID: 125752212 Date: 2022-11-25
*
* Online (Heroku Cyclic) Link: 
*
********************************************************************************/
const express = require('express')
const fs = require('fs')
const path = require('path')
const dataService = require('./data-service')
const multer = require('multer')
const handlebars = require('express-handlebars')
const dataServiceAuth = require('./data-service-auth')
const clientSessions = require('client-sessions')

const app = express()
const PORT = process.env.PORT || 8080

const storage = multer.diskStorage({
    destination: "./public/images/uploaded/",
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
const upload = multer({storage: storage});

app.engine('hbs', handlebars.engine({ extname: '.hbs',
                                      defaultLayout: 'main',
                                      helpers: {
                                        navLink: function(url, options){
                                            return '<li' +
                                            ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                                           
                                            '><a href=" ' + url + ' ">' + options.fn(this) + '</a></li>';
                                           },
                                           equal: function (lvalue, rvalue, options) {
                                                if (arguments.length < 3)
                                                    throw new Error("Handlebars Helper equal needs 2 parameters");
                                                if (lvalue != rvalue) {
                                                    return options.inverse(this);
                                                } else {
                                                    return options.fn(this);
                                                }
                                           },
                                           printDepartmentList: function(employee, departments) {
                                             let result = '<select class="form-control" id="department" name="department">';
                                             for (let i = 0; i < departments.length; i++) {
                                                result += '<option value="' + departments[i].departmentId + '"';
                                                if(departments[i].departmentId == employee.department) 
                                                    result += ' selected';
                                                result += '>' + departments[i].departmentName + '</option>';
                                             }
                                             result += '</select>';
                                             return result;
                                           }                                     
                                      }
                                    }));
app.set('view engine', 'hbs');

app.use(express.static('public'))
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(clientSessions({
    cookieName: "session", // this is the object name that will be added to 'req'
    secret: "week10example_web322", // this should be a long un-guessable string.
    duration: 60 * 60 * 1000, // duration of the session in milliseconds (2 minutes)
    activeDuration: 1000 * 60 * 30 // the session will be extended by this many ms each request (1 minute)
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if(res.locals.session.user)
        next();
    else 
        res.redirect('/login');
}

app.use(function(req,res,next){
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    try {
        const foundUser = await dataServiceAuth.checkUser(req.body);
        req.session.user = {
            userName: foundUser.name,
            email: foundUser.email,
            loginHistory: foundUser.loginHistory
        };
        res.redirect('/employees');
    }
    catch(e) {
        res.render('login', {errorMessage: e, userName: req.body.userName});
    }
});

app.get('/logout', (req, res) => {
    req.session.reset();
    res.redirect('/');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/userHistory', ensureLogin, (req, res) => {
    res.render('userHistory');
});

app.post('/register', async (req, res) => {
    try {
        await dataServiceAuth.registerUser(req.body);
        res.render('register', {successMessage: "User created"});
    }
    catch(e) {
        res.render('register', {errorMessage: e, userName: req.body.name});
    }
}); 

app.get('/', (req, res) => {
    res.render('home')
})
app.get('/images/add', ensureLogin, (req, res) => res.render('addImage'))
app.post('/images/add', ensureLogin, upload.single('imageFile'), (req, res) => res.redirect('/images'))
app.get('/images', ensureLogin, (req, res) => {
    fs.readdir('./public/images/uploaded', {withFileTypes: true}, (err, files) => {
        if(err)
            res.send('could not read a file')
        else {
            res.render('images', {images: files})
        }
    })
})
app.get('/employees', ensureLogin, async (req, res) => {
    try {
        let arr = [];
        if(req.query.department)
            arr = await dataService.getEmployeesByDepartment(req.query.department);
        else if(req.query.manager)
            arr = await dataService.getEmployeesByManager(req.query.manager);
        else if(req.query.status)
            arr = await dataService.getEmployeesByStatus(req.query.status);
        else 
            arr = await dataService.getAllEmployees()
        res.render('employees', {arr})
    }
    catch(err) {
        res.render('employees', {message: err})
    }
})
app.get('/departments', ensureLogin, async (req, res) => {
    try {
        const departments = await dataService.getDepartments();
        if(departments.length > 0)
            res.render('departments', {arr: departments})
        else 
            res.render('departments', {message: 'no results'})
    }
    catch(err) {
        res.render('departments', {message: err})
    }
})
app.get("/employee/:empNum", ensureLogin, (req, res) => {
    let viewData = {};
    dataService.getEmployeeByNum(req.params.empNum)
    .then((data) => {
        if (data) {
            viewData.employee = data; //store employee data in the "viewData" object as "employee"
        } else {
            viewData.employee = null; // set employee to null if none were returned
        }
    })
    .catch(() => {
        viewData.employee = null; // set employee to null if there was an error
    })
    .then(dataService.getDepartments)
    .then((data) => {
        viewData.departments = data; 
        for (let i = 0; i < viewData.departments.length; i++) {
            if (viewData.departments[i].departmentId == viewData.employee.department) {
                viewData.departments[i].selected = true;
        }
        }
    })
    .catch(() => {
        viewData.departments = []; // set departments to empty if there was an error
    })
    .then(() => {
        if (viewData.employee == null) { // if no employee - return an error
            res.status(404).send("Employee Not Found");
        } else {
            res.render("employee", { viewData: viewData }); // render the "employee" view
        }
    });
});
app.get('/employees/delete/:empNum', ensureLogin, (req, res) => {
    dataService.deleteEmployeeByNum(req.params.empNum)
    .then(() => res.redirect('/employees'))
    .catch((err) => res.status(500).send(err))
});
app.post("/employee/update", ensureLogin, (req, res) => {
    dataService.updateEmployee(req.body)
    .then(() => res.redirect("/employees"))
    .catch((err) => res.redirect("/employees"))
});
app.get('/employees/add', ensureLogin, async (req, res) => {
    let departments;
    try {
        departments = await dataService.getDepartments();
    }
    catch(err) {
        departments = [];
    }

    res.render('addEmployee', {departments})   
})
app.post('/employees/add', ensureLogin, (req, res) => {
    dataService.addEmployee(req.body)
    .then(() => res.redirect('/employees'))
    .catch((err) => res.status(500).send(err))
})
app.get('/about', (req, res) => res.render('about'))
app.get('/departments', ensureLogin, (req, res) => {
    dataService.getDepartments()
    .then((data) => res.json(data))
    .catch((err) => res.json({message: err}))
})
app.get('/departments/add', ensureLogin, (req, res) => {
    res.render('addDepartment');
});
app.post('/departments/add', ensureLogin, (req, res) => {
    dataService.addDepartment(req.body)
    .then(() => res.redirect('/departments'))
    .catch((err) => res.status(500).send(err))
})
app.post('/departments/update', ensureLogin, (req, res) => {
    dataService.updateDepartment(req.body)
    .then(() => res.redirect("/departments"))
    .catch((err) => res.status(500).send(err))
});
app.get('/department/:id', ensureLogin, (req, res) => {
    dataService.getDepartmentById(req.params.id)
    .then(data => {
        if(data) {
            res.render('department', {
                data
            })  
        }
        else {
            res.status(404).send('Department not found');
        }
    }) 
    .catch(err => {
        res.status(404).send('Department not found');
    })
})
app.get('/managers', (req, res) => {
    dataService.getManagers()
    .then((data) => res.json(data))
    .catch((err) => res.json({message: err}))
})

app.use((req, res) => res.status(404).send('404 not found'))

dataService.Initialize()
.then(dataServiceAuth.initialize)
.then(() => app.listen(PORT || 8080, () => console.log(`Listening on port ${PORT}`)))
.catch(err => console.log(err))