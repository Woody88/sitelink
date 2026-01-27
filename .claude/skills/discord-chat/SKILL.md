# Discord Chat Skill

Start a background agent that monitors Discord DMs and responds to messages.

## Configuration

- **Channel ID**: 1401428807503581336 (DM with Woodson)
- **Bot User ID**: 1400735630366871572 (Claude#5299 - ignore messages from this ID)

## Instructions

Launch a background Task agent with these parameters:

```
subagent_type: general-purpose
run_in_background: true
allowed_tools: ["mcp__mcp-discord__discord_read_messages", "mcp__mcp-discord__discord_send", "Bash(sleep*)"]
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

Keep the loop running until the task times out. Be conversational and helpful in your responses.

## Usage

After launching, inform the user:
- The background agent is polling their Discord DMs every 2 seconds
- They can send messages to Claude#5299
- Type "status" to check agent progress
- Type "stop" to terminate the agent
