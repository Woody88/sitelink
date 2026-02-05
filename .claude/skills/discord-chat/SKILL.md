# Discord Chat Skill

Start a background agent that monitors Discord DMs and responds to messages. Also supports sending messages with attachments via HTTP API to DMs or server channels.

## Configuration

- **DM Channel ID**: 1401428807503581336 (DM with Woodson)
- **Sitelink Channel ID**: 1468494036506513512 (Server channel)
- **Server ID**: 1400737043340070922
- **Bot User ID**: 1400735630366871572 (Claude#5299 - ignore messages from this ID)
- **Scripty Bot**: https://scripty.org/ (speech-to-text transcription bot)
- **HTTP API**: http://localhost:3000 (requires discord-claude-bot server running)

## Voice Message Handling (Scripty)

The user uses **Scripty** (https://scripty.org/) for speech-to-text transcription. When the user sends a voice message, you will see:

1. **First**: An attachment from the user (the voice/audio file)
2. **Then**: A transcription message from Scripty bot containing the spoken text

**Important**: Treat Scripty's transcription as if it came directly from Woodson. The transcribed text IS the user's message - respond to it naturally as you would any text message from them.

## Instructions

Launch a background Task agent with these parameters:

```
subagent_type: general-purpose
run_in_background: true
allowed_tools: ["mcp__mcp-discord__discord_read_messages", "mcp__mcp-discord__discord_send", "Bash(sleep*)", "Bash(curl*)"]
```

**Agent Prompt:**

You are a Discord chat responder. Continuously poll for new messages in a Discord DM channel and respond to them.

Channel ID: 1401428807503581336
Bot user ID: 1400735630366871572 (Claude bot - ignore messages from this ID)

Instructions:
1. Use mcp__mcp-discord__discord_read_messages to read the latest 5 messages from the channel
2. Track the most recent message ID you've seen
3. If you see a NEW message from a user (not the bot), respond to it using mcp__mcp-discord__discord_send
4. Wait 2 seconds (use Bash sleep 2)
5. Repeat steps 1-4 continuously

**Voice Messages (Scripty):**
The user uses Scripty (https://scripty.org/) for speech-to-text. When they send a voice message:
- You'll first see an attachment (audio file) from Woodson
- Then Scripty bot will post a transcription of what was said
- Treat Scripty's transcription as the user's actual message and respond to it
- Don't respond to the audio attachment itself - wait for the transcription

Keep the loop running until the task times out. Be conversational and helpful in your responses.

## Reading Messages via HTTP API

Read messages from any channel using the `/api/read-messages` endpoint.

### Read Messages

```bash
curl -s "http://localhost:3000/api/read-messages?channel_id=1468494036506513512&limit=5"
```

**Parameters:**
- `channel_id` (required): The Discord channel ID
- `limit` (optional): Number of messages to fetch (default: 10, max: 100)

**Response:**

```json
{
  "success": true,
  "messages": [
    {
      "id": "1468549836512165985",
      "content": "Message text here",
      "author": {
        "id": "599216390368526348",
        "username": "Woodson",
        "bot": false
      },
      "timestamp": 1770199965361,
      "attachments": [
        {
          "id": "123456789",
          "name": "voice-message.ogg",
          "url": "https://cdn.discordapp.com/...",
          "contentType": "audio/ogg"
        }
      ]
    }
  ]
}
```

Use `author.bot` to filter out bot messages. Messages are returned newest first.

## Sending Messages via HTTP API

The HTTP API at `http://localhost:3000/api/send-message` supports text messages, file attachments, and sending to specific channels.

### Text Message to DM (default)

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello from Claude!"}'
```

### Text Message to Server Channel

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello sitelink channel!","channel_id":"1468494036506513512"}'
```

### Message with Markdown

Discord supports full markdown formatting:

```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{"message":"**Bold** and *italic*\n\n```ts\nconst x = 1;\nconsole.log(x);\n```","channel_id":"1468494036506513512"}
EOF
```

**Supported Markdown:**
- `**bold**` → **bold**
- `*italic*` or `_italic_` → *italic*
- `~~strikethrough~~` → ~~strikethrough~~
- `` `inline code` `` → `inline code`
- ` ```lang\ncode\n``` ` → code blocks with syntax highlighting
- `> quote` → block quotes
- `[link](url)` → hyperlinks

### Message with Attachment to DM

Use multipart/form-data to send files:

```bash
curl -X POST http://localhost:3000/api/send-message \
  -F "message=Here's the screenshot" \
  -F "file=@/path/to/image.png"
```

### Message with Attachment to Channel

```bash
curl -X POST http://localhost:3000/api/send-message \
  -F "message=Check this out" \
  -F "channel_id=1468494036506513512" \
  -F "file=@/path/to/image.png"
```

### Attachment Only (No Text)

```bash
curl -X POST http://localhost:3000/api/send-message \
  -F "channel_id=1468494036506513512" \
  -F "file=@/path/to/document.pdf"
```

### Multiple Attachments

```bash
curl -X POST http://localhost:3000/api/send-message \
  -F "message=Here are the files" \
  -F "channel_id=1468494036506513512" \
  -F "file=@/path/to/image1.png" \
  -F "file=@/path/to/image2.jpg"
```

### API Response

```json
{"success": true, "message": "Message sent", "attachments": 1, "channel": "1468494036506513512"}
```

When no `channel_id` is provided, messages are sent as DMs:
```json
{"success": true, "message": "Message sent", "attachments": 0, "channel": "DM"}
```

## Usage

After launching, inform the user:
- The background agent is polling their Discord DMs every 2 seconds
- They can send messages to Claude#5299
- Type "status" to check agent progress
- Type "stop" to terminate the agent

To send messages/attachments manually:
- Use `curl` with the HTTP API examples above
- Server must be running at localhost:3000
- Omit `channel_id` for DMs, include it for server channels
