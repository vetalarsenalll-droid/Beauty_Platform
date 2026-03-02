const fs = require('fs');
const p = 'apps/web/app/api/v1/public/ai/chat/route.ts';
let t = fs.readFileSync(p, 'utf8');

// Remove accidental early usage before declaration.
t = t.replace(/\n\s*if \(explicitClientListFollowUp\) intent = "my_bookings";\n\s*if \(explicitClientReschedulePhrase\) intent = "reschedule_my_booking";/, '\n    if (explicitClientReschedulePhrase) intent = "reschedule_my_booking";');

// Rebuild the whole block from hasClientActionCue to looksLikeSpecialistChoiceText.
const blockRe = /\n\s*const hasClientActionCue = explicitClientListFollowUp \|\| has\(messageForRouting,[\s\S]*?\n\s*const looksLikeSpecialistChoiceText = \^\[\\p\{L\}\\s\\-\]\{3,\}\$\/u\.test\(messageForRouting\.trim\(\)\);/;
const newBlock = `
    const hasClientActionCue = explicitClientListFollowUp || has(messageForRouting, /(какая у меня|моя статист|мои записи|мои данные|покажи мои|ближайш.*запис|предстоящ.*запис|последн.*запис|прошедш.*запис|отмени мою|перенеси мою|личн(ый|ого) кабинет)/i);
    if (explicitClientListFollowUp) intent = "my_bookings";
    const hasPositiveFeedbackCue = has(messageForRouting, /(спасибо|благодар|круто|отлично|здорово|понятно|ок\\b|окей|ясно|супер)/i);
    const specialistPromptedByAssistant =
      hasDraftContextEarly &&
      has(lastAssistantText, /(доступны специалисты|выберите специалиста|выберите кнопкой ниже)/i);
    const looksLikeSpecialistChoiceText = /^[\\p{L}\\s\\-]{3,}$/u.test(messageForRouting.trim());`;

if (blockRe.test(t)) {
  t = t.replace(blockRe, newBlock);
}

// Ensure explicitClientListFollowUp is declared once before hasClientActionCue.
if (!t.includes('const explicitClientListFollowUp =')) {
  const marker = '    const choiceNum = parseChoiceFromText(t);';
  const ins = `${marker}\n    const explicitClientListFollowUp =\n      /^(?:все|всё|все напиши|всё напиши|все покажи|всё покажи|все записи|все прошедшие|все предстоящие|прошедшие|предстоящие|ближайшие|последние)$/iu.test(\n        messageForRouting.trim(),\n      ) && /(?:запис|прошедш|предстоящ|ближайш|последн)/i.test(lastAssistantText);`;
  t = t.replace(marker, ins);
}

fs.writeFileSync(p, t, 'utf8');
