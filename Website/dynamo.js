const AWS = require("aws-sdk");
require('dotenv').config();

AWS.config.update({
    region: process.env.AWS_DEFAULT_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamoClient = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = "jcesports-db";
const LOGIN_TABLE = 'jcesports-db-users'

const getStudents = async () => {
    const params = {
        TableName: TABLE_NAME
    };
    const students = await dynamoClient.scan(params).promise();
    console.log(students);
    return students;
}

const getUsers = async () => {
    const params = {
        TableName: LOGIN_TABLE
    };
    const users = await dynamoClient.scan(params).promise();
    console.log(users);
    return users;
}

const addOrUpdateRegistration = async (array) => {
    const params = {
        TableName: LOGIN_TABLE,
        Item: array
    };
    return await dynamoClient.put(params).promise();
}

const checkIfEmail = async (emailToCheck) => {
    const params = {
        TableName: LOGIN_TABLE,
        FilterExpression: 'email = :email',
        ExpressionAttributeValues: {
            ':email': emailToCheck
        }
    };
    return await dynamoClient.scan(params).promise();
};

const addOrUpdateStudent = async (student) => {
    const params = {
        TableName: TABLE_NAME,
        Item: student
    };
    return await dynamoClient.put(params).promise();
}

const getStudentById = async (id) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            id
        }
    }
    return await dynamoClient.get(params).promise();
};

const deleteStudent = async (id) => {
    const params = {
        TableName: TABLE_NAME,
        Key: {
            id
        }
    }
    return await dynamoClient.delete(params).promise();
};

module.exports = {
    dynamoClient,
    getStudents,
    getStudentById,
    addOrUpdateStudent,
    deleteStudent,
    checkIfEmail,
    addOrUpdateRegistration,
    getUsers
};