# Claude Context Extender

A fun tool that enables Claude to work effectively with documents that exceed its context window size.

## 📖 Overview

Claude Context Extender is a Node.js application that enhances Claude's ability to process and answer questions about large documents by using an iterative approach. It intelligently splits documents into manageable chunks, creates an index for efficient retrieval, and processes relevant sections sequentially to produce comprehensive answers.

The tool implements an advanced Retrieval-Augmented Generation (RAG) approach that overcomes the context window limitations of large language models.

## ✨ Key Features

- **Smart Chunking**: Automatically breaks documents into optimal segments with configurable overlap
- **Efficient Indexing**: Creates compact but effective indexes with summaries and keywords for each chunk
- **Semantic Search**: Uses Claude to identify the most relevant chunks for a query
- **Iterative Processing**: Processes one chunk at a time to handle documents of any size
- **Progressive Answer Building**: Continuously refines answers as more information is processed
- **Conversation Management**: Maintains conversation history with automatic summarization
- **Rate Limiting**: Intelligently manages API request timing to prevent rate limit errors

## 🛠️ Installation

### Prerequisites

- Node.js (v14 or later)
- An Anthropic API key for Claude

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/claude-context-extender.git
   cd claude-context-extender
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create configuration files:
   ```bash
   cp .env.example .env
   # Edit .env and add your Claude API key
   ```

4. Make the CLI executable:
   ```bash
   chmod +x bin/cli.js
   ```

5. Run the setup script:
   ```bash
   npm run setup
   ```

## 📝 Usage

### Creating an Index

```bash
# Index a single file
node bin/cli.js index path/to/document.pdf --name "My Document"

# Index a directory of documents
node bin/cli.js index path/to/documents/ --name "My Collection"
```

### Querying an Index

```bash
# Query an index by ID
node bin/cli.js query your-index-id -q "What is the main thesis of this document?"

# Interactive query mode
node bin/cli.js query your-index-id
```

### Managing Indexes

```bash
# List all indexes
node bin/cli.js list

# View details about a specific index
node bin/cli.js info your-index-id

# Delete an index
node bin/cli.js delete your-index-id
```

### Managing Conversations

```bash
# List all conversations
node bin/cli.js conversations

# View details about a specific conversation
node bin/cli.js conversation-info your-conversation-id

# Delete a conversation
node bin/cli.js delete-conversation your-conversation-id
```

### Configuration

```bash
# View current configuration
node bin/cli.js config --view

# Update configuration
node bin/cli.js config --update
```

## ⚙️ Configuration Options

The system can be customized through the `config/default.json` file:

| Category    | Option                     | Description                                      | Default  |
|-------------|----------------------------|--------------------------------------------------|----------|
| claude      | model                      | Claude model to use                              | claude-3-5-haiku-20241022 |
| claude      | maxTokens                  | Maximum context window size                      | 100000   |
| claude      | tokenRatePerMinute         | Rate limit for tokens per minute                 | 50000    |
| chunking    | chunkSizePercentage        | Size of each chunk relative to context window    | 40%      |
| chunking    | overlapPercentage          | Overlap between chunks                           | 10%      |
| query       | maxChunksPerQuery          | Maximum chunks to process per query              | 5        |
| conversation| maxRecentExchanges         | Recent exchanges to keep in full                 | 5        |
| conversation| mergeFrequency             | Frequency of merging old conversation history    | 3        |

## 🏗️ Project Structure

```
claude-context-extender/
├── bin/                      # CLI scripts
│   └── cli.js                # Main CLI entry point
│
├── config/                   # Configuration files
│   └── default.json          # Default configuration
│
├── data/                     # Data storage
│   ├── indexes/              # Stored indexes
│   └── conversations/        # Stored conversations
│
├── scripts/                  # Utility scripts
│   ├── install.js            # Installation script
│   └── organize-files.js     # Project structure script
│
├── src/                      # Source code
│   ├── app.js                # Main application entry point
│   ├── controllers/          # Application controllers
│   ├── services/             # Core services
│   │   ├── FileProcessor.js  # File reading and chunking
│   │   ├── IndexManager.js   # Index management
│   │   ├── ClaudeClient.js   # Claude API client
│   │   └── IterativeAnswerer.js # Iterative answer generation
│   ├── cli/                  # CLI implementation
│   ├── utils/                # Utility modules
│   └── models/               # Data models
│
├── .env.example              # Example environment variables
├── package.json              # Project metadata and dependencies
└── README.md                 # Project documentation
```

## 🚀 How It Works

1. **Document Processing**:
   - Documents are split into chunks of manageable size
   - Each chunk is processed to create summaries and keywords
   - A searchable index is built from these chunks

2. **Query Handling**:
   - When a question is asked, the system finds the most relevant chunks
   - The chunks are processed one by one in order of relevance
   - With each chunk, the answer is progressively built and refined
   - A final summarization step ensures the answer is coherent and complete

3. **Conversation Management**:
   - The system tracks conversation history
   - Recent exchanges are kept in full
   - Older exchanges are merged into a summary to save space
   - This enables unlimited conversation length

## 🔄 Comparison with Traditional RAG

Our simple approach enhances traditional RAG (Retrieval-Augmented Generation) in several ways:

1. **Iterative Processing**: Instead of passing all relevant chunks at once (which can exceed the context window), we process them sequentially.

2. **Progressive Refinement**: The answer is built step by step, with each new chunk potentially adding or correcting information.

3. **Working Memory**: The system maintains a "working memory" of the current answer as it processes more information.

4. **Unlimited Document Size**: By processing chunks sequentially, the system can handle documents of any size.

5. **Conversation Continuity**: The conversation history management allows for ongoing interactions about large documents.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- Anthropic for the Claude API
- My mom, who always had faith in me

---

Built with ❤️ for educational purposes capabilities.