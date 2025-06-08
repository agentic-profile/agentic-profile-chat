import {
    HandleAgentChatMessageParams
} from "./models.js";


export async function handleAgentChatMessage({ envelope, agentSession }: HandleAgentChatMessageParams) {
    const reply = { content: "Are you sure?", created: new Date() };
    console.log( "(simple) handleAgentChatMessage", envelope, agentSession, reply );
    return { reply };
}