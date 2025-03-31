# Claude Context Extender

כלי המאפשר לקלוד לעבוד עם קלט גדול מעבר לחלון ההקשר שלו.

## סקירה כללית

Claude Context Extender הוא יישום CLI מבוסס Node.js המאפשר לעבוד עם מסמכים גדולים יותר מחלון ההקשר של קלוד. זה עובד על ידי:

1. חלוקת מסמכים גדולים לקטעים קטנים יותר
2. יצירת אינדקס עם תקצירים ומילות מפתח לכל קטע
3. מציאת הקטעים הרלוונטיים ביותר בעת מענה לשאלות
4. שימוש בקלוד כדי לספק תשובות המבוססות רק על החלקים הרלוונטיים

גישה זו מאפשרת לקלוד לעבוד ביעילות עם מסמכים גדולים הרבה יותר ממה שהיה מתאפשר בדרך כלל בחלון ההקשר שלו.

## תכונות

- עיבוד קבצי טקסט ו-PDF
- חלוקה אוטומטית לקטעים עם גודל וחפיפה הניתנים להגדרה
- אינדוקס חכם עם תקצירים ומילות מפתח מיוצרים על ידי קלוד
- שמירה קבועה של אינדקסים
- ממשק CLI פשוט ליצירת אינדקסים ושאילתות מסמכים
- אפשרויות הגדרה לכיוונון ביצועים
- ניהול שיחות מתמשכות עם זיכרון דינמי

## דרישות מקדימות

- Node.js 14 ומעלה
- מפתח API של קלוד

## התקנה

1. שכפל את המאגר:
   ```bash
   git clone https://github.com/yourusername/claude-context-extender.git
   cd claude-context-extender
   ```

2. התקן תלויות:
   ```bash
   npm install
   ```

3. צור קובץ `.env` עם מפתח ה-API של קלוד:
   ```bash
   cp .env.example .env
   # ערוך את .env כדי להוסיף את מפתח ה-API שלך
   ```

4. הפוך את ה-CLI לאפשרי להפעלה:
   ```bash
   chmod +x bin/cli.js
   ```

5. אופציונלית, התקן גלובלית:
   ```bash
   npm install -g .
   ```

## שימוש

### יצירת אינדקס

```bash
context-extender index path/to/file.pdf --name "My Document"
```

או

```bash
context-extender index path/to/directory --name "My Project Documents"
```

### שאילתה באינדקס

```bash
context-extender query your-index-id -q "What is the main thesis of this document?"
```

או פשוט:

```bash
context-extender query
```
ועקוב אחר ההנחיות האינטראקטיביות.

### רשימת אינדקסים

```bash
context-extender list
```

### צפייה במידע על אינדקס

```bash
context-extender info your-index-id
```

### מחיקת אינדקס

```bash
context-extender delete your-index-id
```

### צפייה ברשימת שיחות

```bash
context-extender conversations [indexId]
```

### הגדרת הגדרות

```bash
context-extender config --view
context-extender config --update
```

## הגדרות

ניתן להגדיר את היישום על ידי עריכת הקובץ `config/default.json` או באמצעות פקודת `config`. אפשרויות הגדרה מרכזיות כוללות:

- `chunking.chunkSizePercentage`: אחוז מחלון ההקשר של קלוד לשימוש עבור כל קטע (ברירת מחדל: 40%)
- `chunking.overlapPercentage`: אחוז חפיפה בין קטעים (ברירת מחדל: 10%)
- `query.maxChunksPerQuery`: מספר מקסימלי של קטעים לכלול בשאילתה (ברירת מחדל: 5)
- `conversation.maxRecentExchanges`: מספר החלפות שיחה אחרונות לשמירה (ברירת מחדל: 5)
- `conversation.mergeFrequency`: תדירות מיזוג היסטוריית שיחה (ברירת מחדל: כל 3 חלפות)

## מבנה הפרויקט

```
claude-context-extender/
├── bin/                      # סקריפטים לשורת הפקודה
│   └── cli.js                # נקודת כניסה לכלי ה-CLI
├── config/                   # קבצי הגדרות
│   ├── default.json          # הגדרות ברירת מחדל
│   └── user.json             # הגדרות משתמש (נוצר לאחר שינויי הגדרות)
├── data/                     # נתונים
│   ├── indexes/              # אינדקסים מאוחסנים
│   └── conversations/        # שיחות מאוחסנות
├── logs/                     # קבצי לוג
├── src/                      # קוד מקור
│   ├── app.js                # נקודת כניסה ראשית
│   ├── controllers/          # שכבת בקרה
│   │   └── AppController.js  # בקר ראשי
│   ├── services/             # שירותים עיקריים
│   │   ├── FileProcessor.js  # קריאה וחלוקת קבצים
│   │   ├── IndexManager.js   # ניהול אינדקס
│   │   ├── ClaudeClient.js   # לקוח API של קלוד
│   │   └── ConversationManager.js # ניהול שיחות
│   ├── cli/                  # ממשק שורת פקודה
│   │   └── CLIManager.js     # מנהל CLI
│   ├── utils/                # כלים שימושיים
│   │   ├── ConfigManager.js  # ניהול הגדרות
│   │   └── Logger.js         # מערכת לוגים
│   └── models/               # מודלים נתונים
│       └── Chunk.js          # מודל קטע
├── package.json
└── README.md
```

## רשיון

MIT
