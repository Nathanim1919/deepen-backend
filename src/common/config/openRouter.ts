import { OpenRouter } from '@openrouter/sdk';
import { Message } from '@openrouter/sdk/esm/models';


export const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY as string,
});


export async function sendMessage(
  model: string,
  messages: Message[],
  signal?: AbortSignal
) {
  return openRouter.chat.send(
    {
      model,
      messages,
      stream: true,
      streamOptions: { includeUsage: true },
    },
    { signal }
  );
}



export const listModels = async () => {
  const models = await openRouter.models.list();
  console.log(":- models -> models :-", models);
  return models;
};