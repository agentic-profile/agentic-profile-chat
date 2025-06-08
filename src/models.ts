import {
    AgentMessage,
    DID,
    Metadata,
    UserID
} from "@agentic-profile/common/schema";
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

export interface AgentMessageHistory {
    messages: AgentMessage[]
}

export interface AgentChatKey {
    uid: UserID,        // uid that server agent represents (maps to an agentic profile server represents)
    userAgentDid: DID,
    peerAgentDid: DID   // client/peer agent we are chatting with (but may be local)
                        // usually includes a fragment to qualify the exact agent 
}

export interface AgentChat extends AgentChatKey {
    cid: number,
    created: Date,
    updated: Date,
    cost: number,
    aimodel?: string,
    history: AgentMessageHistory,
    userResolution?: Metadata,
    peerResolution?: Metadata
}

export type HandleAgentChatMessageParams = {
    //uid: UserID,
    envelope: ChatMessageEnvelope,
    agentSession: ClientAgentSession    
}

export interface HandleAgentChatMessageResult {
    reply: AgentMessage
}

export interface ChatMessageEnvelope {
    to: DID,
    message: AgentMessage,
    rewind?: string
}

export interface ChatMessageReplyEnvelope {
    reply: AgentMessage
}

// export async function chatCompletion({ agentDid, messages }: ChatCompletionParams ): Promise<ChatCompletionResult>

export interface GenerateChatReplyParams {
    uid: UserID,
    agentDid: DID,
    messages: AgentMessage[]
}

export interface ChatHooks {
    resolveUserAgenticProfileDid( uid: UserID ): Promise<DID>,
    resolveUidFromAgentDid( agentDid: DID ): Promise<UserID>,
    ensureCreditBalance( uid: UserID, actor?: Account ): Promise<number>,
    generateChatReply( params: GenerateChatReplyParams ): Promise<ChatCompletionResult>,
    handleAgentChatMessage( params: HandleAgentChatMessageParams, chatHooks: ChatHooks ): Promise<HandleAgentChatMessageResult>,
    chatStore: ChatStore
}

//
// Persistence/Storage
//

export interface ChatStore {
    fetchAccountFields: ( uid: UserID, fields?: string ) => Promise<Account | undefined>,

    ensureAgentChat: ( key: AgentChatKey, messages?: AgentMessage[] ) => Promise<AgentChat>,
    recordChatCost: ( key: AgentChatKey, cost: number | undefined ) => void,
    insertChatMessage: ( key: AgentChatKey, message: AgentMessage, ignoreFailure?: boolean ) => void,
    updateChatHistory: ( key: AgentChatKey, history: AgentMessageHistory ) => void,
    updateChatResolution: ( key: AgentChatKey, userResolution: Metadata | null | undefined, peerResolution: Metadata | null | undefined ) => void,
    fetchAgentChat: ( key: AgentChatKey ) => Promise<AgentChat | undefined>
}