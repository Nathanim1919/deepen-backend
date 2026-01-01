import { AIPrompt } from '../types';

export const contentPrompts: AIPrompt[] = [
  {
    id: 'summarize',
    name: 'Content Summarization',
    description: 'Generate a concise summary of the provided content',
    template: `Please provide a concise summary of the following content:
    
    {content}
    
    Focus on the main points and key takeaways.`,
    variables: ['content'],
    category: 'summarization'
  },
  {
    id: 'key-points',
    name: 'Key Points Extraction',
    description: 'Extract the main key points from the content',
    template: `Extract the main key points from this content:
    
    {content}
    
    List them in order of importance.`,
    variables: ['content'],
    category: 'analysis'
  },
  {
    id: 'sentiment',
    name: 'Sentiment Analysis',
    description: 'Analyze the sentiment of the content',
    template: `Analyze the sentiment of this content:
    
    {content}
    
    Provide a sentiment score and explanation.`,
    variables: ['content'],
    category: 'analysis'
  }
]; 