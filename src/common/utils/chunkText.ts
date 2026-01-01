export function chunkText(text: string, maxLength = 500): string[] {
    const chunks: string[] = [];
    
    // Split the text into words, preserving sentence boundaries
    const words =  text.split(/(?<=[.!?])\s+/); // Split by sentence-ending punctuation followed by whitespace
    
    let currentChunk = "";

    // Iterate through each word
    for (const word of words) {
        // Check if adding the next word exceeds the max length
        if (currentChunk.length + word.length + 1 > maxLength) {
        // If it does, push the current chunk and start a new one
        if (currentChunk) {
            chunks.push(currentChunk.trim());
        }
        currentChunk = word; // Start a new chunk with the current word
        } else {
        // Otherwise, add the word to the current chunk
        currentChunk += (currentChunk ? " " : "") + word;
        }
    }
    
    // Push any remaining text as a final chunk
    if (currentChunk) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
}