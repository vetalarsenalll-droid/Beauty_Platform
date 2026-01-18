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
          title: 'CRM Бизнес',
          subtitle: 'Календарь, расписание, услуги и клиенты.',
        ),
        SizedBox(height: 16),
        SummaryGrid(
          items: [
            SummaryItem(title: 'Календарь', subtitle: 'День/Неделя/Месяц'),
            SummaryItem(title: 'Расписание', subtitle: 'Смены и перерывы'),
            SummaryItem(title: 'Услуги', subtitle: 'Категории и цены'),
            SummaryItem(title: 'Клиенты', subtitle: 'История и заметки'),
          ],
        ),
      ],
    );
  }
}
