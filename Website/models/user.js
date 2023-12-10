function User(userObj) {
    this.id = userObj.id;
    this.email = userObj.email;
    this.authority = userObj.authority;
}
module.exports = User;