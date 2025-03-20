import {
    HandleAgentChatMessageParams
} from "./models.js";


export async function handleAgentChatMessage({ uid, envelope, agentSession }: HandleAgentChatMessageParams) {
    const reply = { content: "Are you sure?", created: new Date() };
    console.log( "(simple) handleAgentChatMessage", uid, envelope, agentSession, reply );
    return { reply };
}