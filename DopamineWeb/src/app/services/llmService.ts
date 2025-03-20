import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";

const categorySchema = z.object({
  category: z
    .enum(["work", "study", "social", "other"])
    .describe("The category of the activity")
});

const categoryPrompt = PromptTemplate.fromTemplate(`
Analyze the following window title and process name, and categorize it into one of these categories: work, study, social, or other.

Window Title: {windowTitle}
Process Name: {processName}

Rules:
- work: productivity tools, development environments, business applications
- study: educational content, research tools, learning platforms
- social: messaging apps, social media, communication platforms
- other: anything that doesn't fit above categories

Provide only the category name as output.
`);

const structuredLlm = new ChatOpenAI({
    configuration: {
        baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
        apiKey: process.env.VITE_ZHIPUAI_API_KEY,
        dangerouslyAllowBrowser: true 
    }
}).withStructuredOutput(categorySchema);

export async function categorizeActivity(windowTitle: string, processName: string) {
    const formattedPrompt = await categoryPrompt.format({
        windowTitle,
        processName,
    });

    const response = await structuredLlm.invoke([
        {
            role: "user",
            content: formattedPrompt,
        },
    ]);

    return response.category;
}
  