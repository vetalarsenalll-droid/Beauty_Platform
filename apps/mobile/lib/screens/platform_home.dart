import 'package:flutter/material.dart';
import '../widgets/section_header.dart';
import '../widgets/summary_grid.dart';

class PlatformAdminHome extends StatelessWidget {
  const PlatformAdminHome({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        SectionHeader(
          title: 'Platform Admin',
          subtitle: 'Управление платформой и системными настройками.',
        ),
        SizedBox(height: 16),
        SummaryGrid(
          items: [
            SummaryItem(title: 'Аккаунты', subtitle: 'Статусы, лимиты, модули'),
            SummaryItem(title: 'Тарифы', subtitle: 'Планы и подписки'),
            SummaryItem(title: 'Модерация', subtitle: 'Контент и отзывы'),
            SummaryItem(title: 'Мониторинг', subtitle: 'Outbox и webhooks'),
          ],
        ),
      ],
    );
  }
}
