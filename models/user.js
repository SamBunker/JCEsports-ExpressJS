function User(userObj) {
    this.id = userObj.id;
    this.email = userObj.email;
    this.auth = userObj.auth;
}
module.exports = User;