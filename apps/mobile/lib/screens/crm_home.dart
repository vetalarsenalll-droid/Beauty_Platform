import 'package:flutter/material.dart';
import '../widgets/section_header.dart';
import '../widgets/summary_grid.dart';

class CrmHome extends StatelessWidget {
  const CrmHome({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        SectionHeader(
          title: 'CRM Business',
          subtitle:
              'Операционное управление: записи, расписание, клиенты и финансы.',
        ),
        SizedBox(height: 16),
        SummaryGrid(
          items: [
            SummaryItem(title: 'Календарь', subtitle: 'День/неделя/месяц'),
            SummaryItem(title: 'Расписание', subtitle: 'Смены и перерывы'),
            SummaryItem(title: 'Клиенты', subtitle: 'Карточки и теги'),
            SummaryItem(title: 'Финансы', subtitle: 'Выручка и касса'),
          ],
        ),
      ],
    );
  }
}
