import 'package:flutter/material.dart';
import '../widgets/section_header.dart';
import '../widgets/summary_grid.dart';

class BookingHome extends StatelessWidget {
  const BookingHome({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: const [
        SectionHeader(
          title: 'Онлайн-запись',
          subtitle: 'Выбор услуги, мастера и времени.',
        ),
        SizedBox(height: 16),
        SummaryGrid(
          items: [
            SummaryItem(title: 'Услуги', subtitle: 'Каталог и варианты'),
            SummaryItem(title: 'Мастера', subtitle: 'Уровни и портфолио'),
            SummaryItem(title: 'Слоты', subtitle: 'Доступность и время'),
            SummaryItem(title: 'Оплата', subtitle: 'Депозит и онлайн'),
          ],
        ),
      ],
    );
  }
}
