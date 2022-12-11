const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Schema = mongoose.Schema;

let User;
  
function initialize() {
    return new Promise((resolve, reject) => {
            mongoose.connect("mongodb+srv://walter_white:heisenberg@cluster0.9k3caib.mongodb.net/?retryWrites=true&w=majority");

            const userSchema = new Schema({
                name: {
                    type: String,
                    unique: true
                },
                password: String,
                email: String,
                loginHistory: [{
                    dateTime: Date,
                    userAgent: String
                }]
            });

            User = mongoose.model('User', userSchema);
            resolve();
    });
}

function registerUser(userData) {
    return new Promise(async (resolve, reject) => {
        console.log(userData);
        if(userData.password.trim() == '' || userData.password2.trim() == '')
            reject('ERROR: User name cannot be empty or only whitespaces');
        else if(userData.password != userData.password2)
            reject('ERROR: Passwords do not match');
        else {
            try {
                const hash = await bcrypt.hash(userData.password, 10);
                userData.password = hash;
                let user = new User(userData);
                try {
                    await user.save();
                    resolve();
                } 
                catch (error) {
                    if(error.code == 11000)
                        reject('User name already taken');
                    else 
                        reject(`There was an error creating the user: ${error}`);
                }
            } 
            catch (error) {
                reject('There was an error while hashing the password: ' + error);
            }
        }
    });
}

function checkUser(userData) {
    return new Promise(async (resolve, reject) => {
        try {
            const user = await User.findOne({name: userData.userName}).exec();
            if(!user) 
                reject('Unable to find user with name ' + userData.userName);
            else {
                const result = await bcrypt.compare(userData.password, user.password);
                if(result) {
                    console.log(user);
                    user.loginHistory.push({dateTime: new Date().toString(), userAgent: userData.userAgent});
                    try {
                        console.log(user.loginHistory);
                        await User.updateOne({name: user.name}, {$set: {loginHistory: user.loginHistory}});
                        resolve(user);
                    }
                    catch(e) {
                        reject('There was an error verifying the user: ' + e);
                    }
                }
                else {
                    reject('Incorrect password for: ' + userData.userName);
                }
            }
        }
        catch(e) {
            reject('Unable to find user: ' + userData.userName);
        }
    });
}

module.exports = {
    initialize,
    checkUser,
    registerUser
};