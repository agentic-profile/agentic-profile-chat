import {
    ChatMessage,
    ChatResolution,
    CommonStorage,
    DID,
    UserID
} from "@agentic-profile/common";
import { ClientAgentSession } from "@agentic-profile/auth";
import { ChatCompletionResult } from "@agentic-profile/ai-provider";


//
// Users/Accounts
//

export interface User {
    uid: UserID,
    name: string,
    created: Date
}

export interface Account extends User {
    credit?: number
}


//
// Chat
//

export interface StartAgentChat {
    userAgentDid: DID,    // MAY also specify agent as did:web:example.com/dave#agent-7
    peerAgentDid: DID,
    reset?: boolean
}

export interface ChatMessageHistory {
    messages: ChatMessage[]
}

export interface AgentChatKey {
    uid: number | string,       // uid that server agent represents (maps to an agentic profile server represents)
    userAgentDid: DID,
    peerAgentDid: DID           // client/peer agent we are chatting with (but may be local)
                                // usually includes a fragment to qualify the exact agent 
}

export interface AgentChat extends AgentChatKey {
    cid: number,
    created: Date,
    updated: Date,
    cost: number,
    aimodel?: string,
    history: ChatMessageHistory,
    userResolution?: ChatResolution,
    peerResolution?: ChatResolution
}

export type HandleAgentChatMessageParams = {
    uid: UserID,
    envelope: ChatMessageEnvelope,
    agentSession: ClientAgentSession    
}

export interface ChatMessageEnvelope {
    to: DID,
    message: ChatMessage,
    rewind?: string
}

export interface ChatMessageReplyEnvelope {
    reply: ChatMessage
}

// export async function chatCompletion({ agentDid, messages }: ChatCompletionParams ): Promise<ChatCompletionResult>

export interface GenerateChatReplyParams {
    uid: UserID,
    agentDid: DID,
    messages: ChatMessage[]
}

export interface ChatHooks {
    createUserAgentDid: ( uid: UserID ) => DID,
    ensureCreditBalance: ( uid: UserID, actor?: Account ) => Promise<void>,
    generateChatReply: ( params: GenerateChatReplyParams ) => Promise<ChatCompletionResult>,
    handleAgentChatMessage: ( params: HandleAgentChatMessageParams ) => void,
    storage: ChatStorage
}

//
// Persistence/Storage
//

export interface ChatStorage extends CommonStorage {
    fetchAccountFields: ( uid: UserID, fields?: string ) => Promise<Account | undefined>,

    ensureAgentChat: ( key: AgentChatKey, messages?: ChatMessage[] ) => Promise<AgentChat>,
    recordChatCost: ( key: AgentChatKey, cost: number | undefined ) => void,
    insertChatMessage: ( key: AgentChatKey, message: ChatMessage, ignoreFailure?: boolean ) => void,
    updateChatHistory: ( key: AgentChatKey, history: ChatMessageHistory ) => void,
    updateChatResolution: ( key: AgentChatKey, userResolution: ChatResolution | null | undefined, peerResolution: ChatResolution | null | undefined ) => void,
    fetchAgentChat: ( key: AgentChatKey ) => Promise<AgentChat | undefined>
}