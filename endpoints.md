

## **REST Endpoints (HTTP)**

### **Auth / Users**

| Method | Endpoint         | Description                   |
| ------ | ---------------- | ----------------------------- |
| POST   | `/auth/register` | Create new user               |
| POST   | `/auth/login`    | Login + return token/session  |
| GET    | `/users/me`      | Get profile of logged-in user |

### **Chat Rooms**

| Method | Endpoint                 | Description                                     |
| ------ | ------------------------ | ----------------------------------------------- |
| POST   | `/rooms`                 | Create a new chat room (with name, description) |
| GET    | `/rooms`                 | List all rooms user is part of                  |
| GET    | `/rooms/{roomId}`        | Fetch room details                              |
| POST   | `/rooms/{roomId}/invite` | Invite/add someone to the room                  |

### **Message History**

| Method | Endpoint                                    | Description                                 |
| ------ | ------------------------------------------- | ------------------------------------------- |
| GET    | `/rooms/{roomId}/messages?before=timestamp` | Load past messages (pagination / scrolling) |

### **File Repository**

| Method | Endpoint                         | Description                        |
| ------ | -------------------------------- | ---------------------------------- |
| GET    | `/rooms/{roomId}/files`          | List all shared files in that room |
| POST   | `/rooms/{roomId}/files/upload`   | Upload a file                      |
| GET    | `/rooms/{roomId}/files/{fileId}` | Download/view file                 |
| DELETE | `/rooms/{roomId}/files/{fileId}` | Delete file (if perms allow)       |

---

##  **WebSocket Endpoints (Real-time)**

You will use STOMP WebSockets:

### **WebSocket Handshake**

```
/ws
```

### **Client → Server (MessageMapping)**

| STOMP Send To                     | Purpose                            | Parameters                          |
| --------------------------------- | ---------------------------------- | ----------------------------------- |
| `/app/rooms/{roomId}/sendMessage` | Send a chat message                | sender, content, replyTo (optional) |
| `/app/rooms/{roomId}/react`       | Add/Change a reaction on a message | messageId, emoji                    |
| `/app/rooms/{roomId}/typing`      | Indicate typing status             | userId, typing=true/false           |

### **Server → Clients (Subscriptions)**

| Subscribe to                      | Receives                     |
| --------------------------------- | ---------------------------- |
| `/topic/rooms/{roomId}/messages`  | Newly sent messages          |
| `/topic/rooms/{roomId}/reactions` | Updates to message reactions |
| `/topic/rooms/{roomId}/typing`    | Typing status events         |

---

## Data Models (Simplified)

Example JSON for messages:

```json
{
  "id": "msg123",
  "sender": "alex",
  "content": "Hello everyone!",
  "timestamp": 171346392,
  "replyTo": "msg100", 
  "reactions": {
    "👍": ["userA", "userB"],
    "❤️": ["userC"]
  }
}
```

---

## 🧭 Architecture Summary

| Feature                          | REST | WebSocket |
| -------------------------------- | ---- | --------- |
| Login/Auth                       | ✅    | ❌         |
| Room list + details              | ✅    | ❌         |
| Load old messages                | ✅    | ❌         |
| Send new message                 | ❌    | ✅         |
| Receive new message in real time | ❌    | ✅         |
| Reactions / Typing indicators    | ❌    | ✅         |
| File upload/download             | ✅    | ❌         |


