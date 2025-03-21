# API Shopee - Detailed Documentation

## Project Overview

This is a Next.js application that provides a robust API for an e-commerce platform with AI capabilities. The application is designed to manage products, stores, customers, orders, and includes advanced features like AI assistants for customer support.

## Tech Stack

- **Framework**: Next.js 15.2.3
- **Language**: TypeScript
- **Database**: PostgreSQL (with Prisma ORM)
- **Authentication**: JWT (jsonwebtoken)
- **AI Integration**: LangChain, OpenAI
- **Vector Database**: Pinecone
- **Graph Database**: Neo4j
- **Other Technologies**: Supabase, bcrypt, Zod

## Project Structure

```
api-shopee/
├── .next/                  # Next.js build output
├── node_modules/          # Node.js dependencies
├── prisma/                # Database schema and migrations
│   ├── migrations/        # Database migrations
│   ├── schema.prisma      # Prisma schema definition
│   └── schema.sql         # SQL schema
├── public/                # Static assets
├── src/                   # Source code
│   ├── app/               # Next.js app directory
│   │   ├── api/           # API routes
│   │   │   ├── ai/        # AI-related endpoints
│   │   │   ├── auth/      # Authentication endpoints
│   │   │   ├── customers/ # Customer management
│   │   │   ├── delivery-templates/ # Delivery template management
│   │   │   ├── product-delivery/ # Product delivery configuration
│   │   │   ├── product-variants/ # Product variant management
│   │   │   ├── products/  # Product management
│   │   │   ├── protected-example/ # Example of protected routes
│   │   │   └── stores/    # Store management
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   ├── lib/               # Utility functions and services
│   │   ├── ai.ts          # AI-related utilities
│   │   ├── auth.ts        # Authentication utilities
│   │   ├── faq.ts         # FAQ management utilities
│   │   ├── faqUtils.ts    # FAQ utility functions
│   │   ├── pinecone.ts    # Pinecone vector database integration
│   │   └── supabase.ts    # Supabase client initialization
│   ├── middleware/        # Middleware functions
│   │   └── auth.ts        # Authentication middleware
│   └── docs/              # Documentation
├── .env                   # Environment variables
├── .gitignore             # Git ignore file
├── eslint.config.mjs      # ESLint configuration
├── next.config.ts         # Next.js configuration
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
```

## Core Components

### Database Schema

The application uses a relational database with the following key models:

1. **User**: Stores user information including authentication details
2. **Store**: Represents a merchant's store
3. **Product**: Products available in the store
4. **ProductVariant**: Variations of products (sizes, colors, etc.)
5. **Customer**: Store customers
6. **Order**: Customer orders
7. **OrderItem**: Individual items in an order
8. **DeliveryTemplate**: Templates for product delivery
9. **ProductDeliveryConfig**: Configuration for product delivery
10. **AiConfig**: AI assistant configuration
11. **FaqDocument**: Frequently asked questions for the AI assistant
12. **ResponseTemplate**: Templates for automated responses
13. **ChatMessage**: Messages exchanged between customers and the store
14. **SubscriptionPlan**: Available subscription plans
15. **Subscription**: User subscriptions
16. **ApiKey**: API keys for authentication
17. **ChannelIntegration**: Integration with external channels
18. **SystemLog**: System logs for monitoring

### Authentication System

The authentication system is JWT-based with the following features:

1. **Registration**: Creates new user accounts
2. **Login**: Authenticates users and issues JWT tokens
3. **Token Verification**: Validates JWT tokens
4. **Auth Middleware**: Protects routes requiring authentication

The core authentication logic is implemented in:

- `src/lib/auth.ts`: Contains token generation and verification functions
- `src/middleware/auth.ts`: Middleware for protecting routes
- `src/app/api/auth/*`: API routes for auth operations

### AI Integration

The application features sophisticated AI capabilities:

1. **Vector Search**: Using Pinecone for semantic search
2. **FAQ Management**: Storing and retrieving FAQ documents
3. **Entity Detection**: Identifying entities in customer messages
4. **Intent Analysis**: Understanding customer intent
5. **AI Agent**: LangChain-based agent with custom tools
6. **Neo4j Integration**: Graph database for storing chat history

Key AI components are in:

- `src/lib/ai.ts`: AI agent and utilities
- `src/lib/faq.ts`: FAQ management
- `src/lib/pinecone.ts`: Vector database integration

### Store Management

The application supports multi-store management with:

1. **Store Creation**: Setting up new stores
2. **Product Management**: Adding and updating products
3. **Customer Management**: Tracking store customers
4. **Order Processing**: Managing customer orders
5. **Delivery Configuration**: Setting up delivery methods

### Data Models and Relationships

#### User and Authentication

- Users can have multiple stores
- Users subscribe to subscription plans
- Users can create API keys for programmatic access

#### Store and Products

- Stores contain products
- Products have variants
- Products have delivery configurations
- Stores have AI configurations

#### Customers and Orders

- Customers belong to stores
- Customers place orders
- Orders contain order items
- Orders can trigger auto deliveries

#### AI and Automation

- Stores have FAQ documents
- Stores have response templates
- AI triggers can be configured
- Chat messages are stored and analyzed

## API Endpoints

### Authentication

- `POST /api/auth/register`: User registration
- `POST /api/auth/login`: User login
- `GET /api/auth/me`: Get current user info
- `POST /api/auth/refresh`: Refresh JWT token
- `POST /api/auth/token`: Get new token

### Store Management

- `GET /api/stores`: List stores
- `POST /api/stores`: Create store
- `GET /api/stores/:id`: Get store details
- `PUT /api/stores/:id`: Update store
- `DELETE /api/stores/:id`: Delete store

### Product Management

- `GET /api/products`: List products
- `POST /api/products`: Create product
- `GET /api/products/:id`: Get product details
- `PUT /api/products/:id`: Update product
- `DELETE /api/products/:id`: Delete product

### Product Variants

- `GET /api/product-variants`: List variants
- `POST /api/product-variants`: Create variant
- `GET /api/product-variants/:id`: Get variant details
- `PUT /api/product-variants/:id`: Update variant
- `DELETE /api/product-variants/:id`: Delete variant

### Customer Management

- `GET /api/customers`: List customers
- `POST /api/customers`: Create customer
- `GET /api/customers/:id`: Get customer details
- `PUT /api/customers/:id`: Update customer
- `DELETE /api/customers/:id`: Delete customer

### Delivery Templates

- `GET /api/delivery-templates`: List templates
- `POST /api/delivery-templates`: Create template
- `GET /api/delivery-templates/:id`: Get template details
- `PUT /api/delivery-templates/:id`: Update template
- `DELETE /api/delivery-templates/:id`: Delete template

### Product Delivery

- `GET /api/product-delivery`: List delivery configs
- `POST /api/product-delivery`: Create config
- `GET /api/product-delivery/:id`: Get config details
- `PUT /api/product-delivery/:id`: Update config
- `DELETE /api/product-delivery/:id`: Delete config

### AI Features

- `POST /api/ai/query`: Query AI assistant
- `POST /api/ai/faq`: Manage FAQ documents
- `POST /api/ai/templates`: Manage response templates

## Key Business Logic

### Authentication Flow

1. User registers or logs in
2. Server validates credentials
3. JWT token is generated and returned
4. Token is used for subsequent authenticated requests
5. Middleware validates token on protected routes

### Order and Delivery Process

1. Customer places an order
2. Order items are created
3. System checks delivery configuration
4. If auto-delivery is enabled, delivery is triggered
5. Delivery can use templates or AI-generated content

### AI Assistant Workflow

1. Customer message is received
2. Intent and entities are analyzed
3. Relevant FAQ documents are retrieved
4. AI agent generates response using:
   - Product information
   - FAQ documents
   - Response templates
   - Conversation history
5. Response is stored and sent to customer

### Subscription Management

1. Users subscribe to plans
2. Subscription status is checked
3. Features are enabled/disabled based on subscription

## Security Features

1. **Password Hashing**: Using bcrypt for secure password storage
2. **JWT Authentication**: Token-based authentication
3. **API Key Authentication**: For programmatic access
4. **Role-Based Access Control**: Different permissions for different users
5. **Input Validation**: Using Zod for schema validation

## Environment Variables

The application requires the following environment variables:

```
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-api-key
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=your-pinecone-environment
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-neo4j-password
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Development and Deployment

### Development

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Linting

```bash
npm run lint
```
