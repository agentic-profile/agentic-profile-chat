import {
    agentHooks,
    ChatMessage,
    DID
} from "@agentic-profile/common";
import {
    ChatCompletionParams,
    ChatCompletionResult
} from "@agentic-profile/ai-provider";
import log from "loglevel";

import {
    AgentChat,
    AgentChatKey,
    ChatHooks,
    ChatMessageEnvelope,
    GenerateChatReplyParams,
    HandleAgentChatMessageParams,
    User
} from "./models.js";


// This is the server side handling a chat message from a client
export async function handleAgentChatMessage({ uid, envelope, agentSession }: HandleAgentChatMessageParams) {
    const { agentDid: peerAgentDid } = agentSession;    // client agent URI
    const userAgentDid = agentHooks<ChatHooks>().createUserAgentDid( uid ) + "#agent-chat";
    const { message, rewind } = envelope;
    const chatKey = { uid, userAgentDid, peerAgentDid } as AgentChatKey;

    // validate the message
    if( !message )
        throw new Error( "Missing chat message" );
    if( message.from !== peerAgentDid )
        throw new Error( "Chat message 'from' does not match session agentDid: " + message.from + ' != ' + peerAgentDid );
    if( !message.created )
        throw new Error( "Chat message missing 'created' property" );
    if( !message.content )
        throw new Error( "Chat message missing content" );

    // fetch all messages for AI
    let chat = await storage().fetchAgentChat( chatKey );
    if( !chat ) {
        log.warn( "Failed to find history, creating new chat", chatKey );
        chat = await storage().ensureAgentChat( chatKey, [ message as ChatMessage ] );
    } else {
        // save incoming message locally (and maybe rewind)
        if( rewind )
            await rewindChat( chatKey, envelope, chat );
        else {
            ensureChatHistoryMessages( chat );
            chat.history.messages.push( message );
            await storage().insertChatMessage( chatKey, message, true );
        }
    }

    if( message.meta?.resolution ) 
        await storage().updateChatResolution( chatKey, undefined, message.meta.resolution );

    // generate reply and track cost
    const params = {
        uid,
        agentDid: userAgentDid, 
        messages: chat.history.messages
    };
    const { reply, json, cost } = await agentHooks<ChatHooks>().generateChatReply( params );
    await storage().recordChatCost( chatKey, cost );

    // save reply locally
    await storage().insertChatMessage( chatKey, reply );

    // any meta/tool data?  Only use first found...
    const meta = json?.find(e=>e.meta)?.meta;
    if( meta ) {
        reply.meta = meta; // pass back to caller

        if( meta.resolution !== undefined ) {  // can be NULL to reset resolution
            log.debug( 'Updating chat resolution', chatKey, meta.resolution );
            await storage().updateChatResolution( chatKey, meta.resolution, undefined );
        }
    }

    return { reply };
}

function ensureChatHistoryMessages( chat: AgentChat ) {
    if( !chat.history )
        chat.history = { messages: [] };
    else if( !chat.history.messages )
        chat.history.messages = [];
}

// if chat is provided, modifies in place
export async function rewindChat( chatKey: AgentChatKey, envelope: ChatMessageEnvelope, chat?: AgentChat ) {
    const { message, rewind } = envelope; 

    if( !chat ) {
        chat = await storage().fetchAgentChat( chatKey );
        if( !chat )
            throw new Error(`Failed to rewind; could not find chat ${chatKey} ${rewind}`);
    }  

    ensureChatHistoryMessages( chat );
    chat.history.messages = rewindMessages( rewind, chat.history.messages );

    if( message )
        chat.history.messages.push( message );

    await storage().updateChatHistory( chatKey, chat.history );
}

export function rewindMessages(rewind: string | undefined, messages: ChatMessage[] = []): ChatMessage[] {
    if( !rewind )
        return messages;

    const rewindDate = new Date(rewind);
    const index = messages.findIndex(msg =>
        msg.created && new Date(msg.created) >= rewindDate
    );

    const rewindIndex = index !== -1 ? index : 0;
    const rewoundMessages = messages.slice(0,rewindIndex);

    log.debug('doRewind rewound', rewindIndex, rewoundMessages);
    return rewoundMessages;
}

export async function generateChatReply({ uid, agentDid, messages}: GenerateChatReplyParams ): Promise<ChatCompletionResult> {
    const user = await storage().fetchAccountFields( uid, "uid,name,credit" );
    if( !user )
        throw new Error("Unable to generate chat reply, cannot find user with id " + uid );
    await agentHooks<ChatHooks>().ensureCreditBalance( uid, user );

    // if there are no messages from me, then introduce myself
    if( messages.some(e=>e.from === agentDid) !== true ) {
        log.trace( 'generateChatReply() no messages, so introducing myself', agentDid, messages );
        return introduceMyself( user, agentDid );
    }
    
    return await chatCompletion({ agentDid, messages });
}

function introduceMyself( user: User, userAgentDid: DID ): ChatCompletionResult {
    const reply = {
        from: userAgentDid,
        content: `My name is ${user.name}. Nice to meet you!`,
        created: new Date()
    } as ChatMessage;
    return { reply, cost: 0.01 };
}

async function chatCompletion({ agentDid, messages }: ChatCompletionParams ): Promise<ChatCompletionResult> {
    const reply = {
        from: agentDid,
        content: "Tell me more...",
        created: new Date()
    } as ChatMessage;
    return { reply };
}

function storage() {
    return agentHooks<ChatHooks>().storage;
}