const fs = require('fs');
const p = 'apps/web/app/api/v1/public/ai/chat/route.ts';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  /(function isOutOfDomainPrompt\(messageNorm: string\) \{\n\s*return \/\()(.*?)(\)\/i\.test\(\n\s*messageNorm,\n\s*\);\n\})/s,
  (m,prefix,body,suffix) => {
    if (body.includes('анегдот')) return m;
    return `${prefix}${body.replace('анекдот|','анекдот|анегдот|')}${suffix}`;
  }
);

c = c.replace(
  /(const hasQuestionCue =\n\s*messageNorm\.includes\("\?"\) \|\|\n\s*\/\^\(кто\|что\|почему\|зачем\|как\|сколько\|где\|когда\|какой\|какая\|какие\|какую\)\\b\/i\.test\(messageNorm\);)/,
  (m) => {
    if (m.includes('расскажи|объясни')) return m;
    return m.replace(');', ' ||\n    /^(расскажи|объясни|обьясни|подскажи|посоветуй|поделись|поговорим|давай\\s+поговорим)\\b/i.test(messageNorm);');
  }
);

c = c.replace(
  /const shouldGenerateSmalltalk =\n\s*route === "chat-only" &&\n\s*!explicitDateTimeQuery &&\n\s*!shouldRunBookingFlow &&\n\s*!explicitServiceComplaint &&\n\s*\(intent === "smalltalk" \|\| intent === "out_of_scope"\);/,
  'const shouldGenerateSmalltalk =\n      route === "chat-only" &&\n      !explicitDateTimeQuery &&\n      !shouldRunBookingFlow &&\n      !explicitServiceComplaint &&\n      (intent === "smalltalk" || intent === "out_of_scope" || (intent === "unknown" && !isBookingOrAccountCue(t)));'
);

c = c.replace(
  /\} else \{\n\s*if \(isOutOfDomainPrompt\(t\) \|\| isGeneralQuestionOutsideBooking\(t\)\) \{\n\s*reply = buildOutOfScopeConversationalReply\(t\);\n\s*\} else \{\n\s*reply = "Я ассистент записи\. Помогу с услугами, датами, временем и специалистами\. Чем помочь\?";\n\s*\}\n\s*\}/,
  '} else {\n        if (generatedSmalltalk && route === "chat-only" && !isBookingOrAccountCue(t)) {\n          reply = generatedSmalltalk;\n        } else if (isOutOfDomainPrompt(t) || isGeneralQuestionOutsideBooking(t)) {\n          reply = buildOutOfScopeConversationalReply(t);\n        } else {\n          reply = "Я ассистент записи. Помогу с услугами, датами, временем и специалистами. Чем помочь?";\n        }\n      }'
);

fs.writeFileSync(p, c, 'utf8');
console.log('OK');
