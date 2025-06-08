//import { pruneFragmentId } from "@agentic-profile/common";
import {
    AgentMessage,
    DID,
    Metadata
} from "@agentic-profile/common/schema";
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
    HandleAgentChatMessageResult,
    User
} from "./models.js";


// This is the server side handling a chat message from a client
export async function handleAgentChatMessage(
    { envelope, agentSession }: HandleAgentChatMessageParams,
    chatHooks: ChatHooks
): Promise<HandleAgentChatMessageResult> {
    const { resolveUidFromAgentDid, chatStore: store, generateChatReply } = chatHooks;
    const { agentDid: peerAgentDid } = agentSession;    // client agent URI
    
    const { to: userAgentDid, message, rewind } = envelope;
    /*
    const { documentId: userAgentDocumentId } = pruneFragmentId( userAgentDid );
    const userProfileDid = await resolveUserAgenticProfileDid( uid );
    if( userProfileDid !== userAgentDocumentId )
        throw new Error( "Chat message 'to' does not match session agentDid: " + userAgentDid + ' != ' + userProfileDid );
    */
    const uid = await resolveUidFromAgentDid( userAgentDid );
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
    let chat = await store.fetchAgentChat( chatKey );
    if( !chat ) {
        log.warn( "Failed to find history, creating new chat", chatKey );
        chat = await store.ensureAgentChat( chatKey, [ message as AgentMessage ] );
    } else {
        // save incoming message locally (and maybe rewind)
        if( rewind )
            await rewindChat( chatKey, envelope, chatHooks, chat );
        else {
            ensureChatHistoryMessages( chat );
            chat.history.messages.push( message );
            await store.insertChatMessage( chatKey, message, true );
        }
    }

    const resolution = message.metadata?.resolution as Metadata;
    if( resolution ) 
        await store.updateChatResolution( chatKey, undefined, resolution );

    // generate reply and track cost
    const params = {
        uid,
        agentDid: userAgentDid, 
        messages: chat.history.messages
    };
    const { reply, json, cost } = await generateChatReply( params );
    await store.recordChatCost( chatKey, cost );

    // save reply locally
    await store.insertChatMessage( chatKey, reply );

    // any meta/tool data?  Only use first found...
    const metadata = json?.find(e=>e.metadata)?.metadata;
    if( metadata ) {
        reply.metadata = metadata; // pass back to caller

        if( metadata.resolution !== undefined ) {  // can be NULL to reset resolution
            log.debug( 'Updating chat resolution', chatKey, metadata.resolution );
            await store.updateChatResolution( chatKey, metadata.resolution, undefined );
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
export async function rewindChat(
    chatKey: AgentChatKey,
    envelope: ChatMessageEnvelope,
    { chatStore: store }: ChatHooks,
    chat?: AgentChat
) {
    const { message, rewind } = envelope; 

    if( !chat ) {
        chat = await store.fetchAgentChat( chatKey );
        if( !chat )
            throw new Error(`Failed to rewind; could not find chat ${chatKey} ${rewind}`);
    }  

    ensureChatHistoryMessages( chat );
    chat.history.messages = rewindMessages( rewind, chat.history.messages );

    if( message )
        chat.history.messages.push( message );

    await store.updateChatHistory( chatKey, chat.history );
}

export function rewindMessages(rewind: string | undefined, messages: AgentMessage[] = []): AgentMessage[] {
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

export async function generateChatReply(
    { uid, agentDid, messages }: GenerateChatReplyParams,
    { ensureCreditBalance, chatStore: store }: ChatHooks
): Promise<ChatCompletionResult> {
    const user = await store.fetchAccountFields( uid, "uid,name,credit" );
    if( !user )
        throw new Error("Unable to generate chat reply, cannot find user with id " + uid );
    await ensureCreditBalance( uid, user );

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
    } as AgentMessage;
    return {
        reply,
        json: [],
        textWithoutJson: reply.content,
        cost: 0.01,
        context: {
            model: "none:introduction-script",
            params: {},
            response: {},
            promptMarkdown: ""
        } 
    } as ChatCompletionResult;
}

async function chatCompletion({ agentDid, messages }: ChatCompletionParams ): Promise<ChatCompletionResult> {
    const reply = {
        from: agentDid,
        content: "Tell me more...",
        created: new Date()
    } as AgentMessage;
    return {
        reply,
        json: [],
        textWithoutJson: reply.content,
        cost: 0.01,
        context: {
            model: "none:hello-script",
            params: {},
            response: {},
            promptMarkdown: ""
        } 
    } as ChatCompletionResult;
}
