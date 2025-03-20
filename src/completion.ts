import {
    ChatCompletionParams,
    ChatCompletionResult
} from "@agentic-profile/ai-provider";

import {
    ChatMessage
} from "@agentic-profile/common";


export async function chatCompletion({ agentDid, messages }: ChatCompletionParams ): Promise<ChatCompletionResult> {
	//const bridge = selectBridge();
    //return await bridge.completion({ agentDid, messages }); // , instruction })

    const reply = {
        from: agentDid,
        content: "Tell me more...",
        created: new Date()
    } as ChatMessage;
    console.log( "chatCompletion", agentDid, messages );
    return { reply };
}