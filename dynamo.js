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
const CALENDAR_TABLE = 'jcesports-db-calendar'

const getStudents = async () => {
    const params = {
        TableName: TABLE_NAME
    };
    const students = await dynamoClient.scan(params).promise();
    return students;
}

const getCalendar = async () => {
    const params = {
        TableName: CALENDAR_TABLE
    };
    const events = await dynamoClient.scan(params).promise();
    return events["Items"]
}

const addOrUpdateCalendarEvent = async (event) => {
    const params = {
        TableName: CALENDAR_TABLE,
        Item: event
    };
    return await dynamoClient.put(params).promise();
}

// sampleEvent = {
//     "id": "0",
//     "title": 'All Day Event',
//     "start": '2023-11-01'
// }

// addOrUpdateCalendarEvent(sampleEvent);



const getUsers = async () => {
    const params = {
        TableName: LOGIN_TABLE
    };
    const users = await dynamoClient.scan(params).promise();
    // console.log(users);
    return users;
}

const deleteUserFromDB = async (email, id) => {
    const params = {
        TableName: LOGIN_TABLE,
        Key: {
            email: email,
            id: id,
        }
    }
    try {
        await dynamoClient.delete(params).promise();
        console.log(`User with email ${email} and id ${id} deleted successfully.`);
    } catch (err) {
        console.error('Error deleting user', err);
    }
};

const getUserFromDB = async (email) => {
    const params = {
        TableName: 'LOGIN_TABLE',
        Key: {
            email
        }
    }
    return await dynamoClient.get(params).promise();
};

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
    getUsers,
    deleteUserFromDB,
    getUserFromDB,
    getCalendar,
    addOrUpdateCalendarEvent
};