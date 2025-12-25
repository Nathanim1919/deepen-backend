import { OpenRouter } from '@openrouter/sdk';


export const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY as string,
});


export const listModels = async () => {
  const models = await openRouter.models.list();
  console.log(":- models -> models :-", models);
  return models;
};