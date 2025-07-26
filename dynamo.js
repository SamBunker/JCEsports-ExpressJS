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
const CALENDAR_TABLE = 'jcesports-db-calendar-events'
const EVENTS_TABLE = 'jcesports-db-events'
const INVITATIONS_TABLE = 'jcesports-db-invitations'
const RSVPS_TABLE = 'jcesports-db-rsvps'

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

const deleteEvent = async (id, start) => {
    const params = {
        TableName: CALENDAR_TABLE,
        Key: {
            id: id,
            start: start,
        }
    };
    return await dynamoClient.delete(params).promise();
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

// const getUserFromDB = async (email) => {
//     const params = {
//         TableName: 'LOGIN_TABLE',
//         Key: {
//             email
//         }
//     }
//     return await dynamoClient.get(params).promise();
// };

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

// Events CRUD Operations
const getEvents = async () => {
    const params = {
        TableName: EVENTS_TABLE
    };
    const events = await dynamoClient.scan(params).promise();
    return events["Items"];
}

const getEventById = async (id, created_at) => {
    const params = {
        TableName: EVENTS_TABLE,
        Key: {
            id: id,
            created_at: created_at
        }
    };
    return await dynamoClient.get(params).promise();
}

const getEventByIdOnly = async (id) => {
    const params = {
        TableName: EVENTS_TABLE,
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: {
            ':id': id
        }
    };
    const result = await dynamoClient.scan(params).promise();
    return result.Items && result.Items.length > 0 ? { Item: result.Items[0] } : { Item: null };
}

const addOrUpdateEvent = async (event) => {
    const params = {
        TableName: EVENTS_TABLE,
        Item: event
    };
    return await dynamoClient.put(params).promise();
}

const deleteEventById = async (id, created_at) => {
    const params = {
        TableName: EVENTS_TABLE,
        Key: {
            id: id,
            created_at: created_at
        }
    };
    return await dynamoClient.delete(params).promise();
}

const getEventsByOrganizer = async (organizer_id) => {
    const params = {
        TableName: EVENTS_TABLE,
        FilterExpression: 'organizer_id = :organizer_id',
        ExpressionAttributeValues: {
            ':organizer_id': organizer_id
        }
    };
    return await dynamoClient.scan(params).promise();
}

// Invitations CRUD Operations
const getInvitations = async () => {
    const params = {
        TableName: INVITATIONS_TABLE
    };
    const invitations = await dynamoClient.scan(params).promise();
    return invitations["Items"];
}

const getInvitationsByEvent = async (event_id) => {
    const params = {
        TableName: INVITATIONS_TABLE,
        FilterExpression: 'event_id = :event_id',
        ExpressionAttributeValues: {
            ':event_id': event_id
        }
    };
    return await dynamoClient.scan(params).promise();
}

const getInvitationsByEmail = async (email) => {
    const params = {
        TableName: INVITATIONS_TABLE,
        FilterExpression: 'invitee_email = :email',
        ExpressionAttributeValues: {
            ':email': email
        }
    };
    return await dynamoClient.scan(params).promise();
}

const addOrUpdateInvitation = async (invitation) => {
    const params = {
        TableName: INVITATIONS_TABLE,
        Item: invitation
    };
    return await dynamoClient.put(params).promise();
}

const deleteInvitation = async (id, event_id) => {
    const params = {
        TableName: INVITATIONS_TABLE,
        Key: {
            id: id,
            event_id: event_id
        }
    };
    return await dynamoClient.delete(params).promise();
}

// RSVPs CRUD Operations
const getRSVPs = async () => {
    const params = {
        TableName: RSVPS_TABLE
    };
    const rsvps = await dynamoClient.scan(params).promise();
    return rsvps["Items"];
}

const getRSVPsByEvent = async (event_id) => {
    const params = {
        TableName: RSVPS_TABLE,
        FilterExpression: 'event_id = :event_id',
        ExpressionAttributeValues: {
            ':event_id': event_id
        }
    };
    return await dynamoClient.scan(params).promise();
}

const getRSVPByInvitation = async (invitation_id, event_id) => {
    const params = {
        TableName: RSVPS_TABLE,
        Key: {
            invitation_id: invitation_id,
            event_id: event_id
        }
    };
    return await dynamoClient.get(params).promise();
}

const addOrUpdateRSVP = async (rsvp) => {
    const params = {
        TableName: RSVPS_TABLE,
        Item: rsvp
    };
    return await dynamoClient.put(params).promise();
}

const deleteRSVP = async (invitation_id, event_id) => {
    const params = {
        TableName: RSVPS_TABLE,
        Key: {
            invitation_id: invitation_id,
            event_id: event_id
        }
    };
    return await dynamoClient.delete(params).promise();
}

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
    getCalendar,
    deleteEvent,
    addOrUpdateCalendarEvent,
    // New Events operations
    getEvents,
    getEventById,
    getEventByIdOnly,
    addOrUpdateEvent,
    deleteEventById,
    getEventsByOrganizer,
    // New Invitations operations
    getInvitations,
    getInvitationsByEvent,
    getInvitationsByEmail,
    addOrUpdateInvitation,
    deleteInvitation,
    // New RSVPs operations
    getRSVPs,
    getRSVPsByEvent,
    getRSVPByInvitation,
    addOrUpdateRSVP,
    deleteRSVP
};