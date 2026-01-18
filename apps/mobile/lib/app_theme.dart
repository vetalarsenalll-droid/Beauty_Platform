import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: Color(0xFF6F6CF0),
    onPrimary: Colors.white,
    secondary: Color(0xFF9A98F5),
    onSecondary: Colors.white,
    error: Color(0xFFB91C1C),
    onError: Colors.white,
    background: Color(0xFFF1EFF8),
    onBackground: Color(0xFF1D1B2C),
    surface: Colors.white,
    onSurface: Color(0xFF1D1B2C),
  );

  return ThemeData(
    colorScheme: colorScheme,
    scaffoldBackgroundColor: colorScheme.background,
    useMaterial3: true,
    textTheme: GoogleFonts.manropeTextTheme().apply(
      bodyColor: colorScheme.onBackground,
      displayColor: colorScheme.onBackground,
    ),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      backgroundColor: Color(0xFFF1EFF8),
      foregroundColor: Color(0xFF1D1B2C),
      centerTitle: false,
    ),
    cardTheme: CardTheme(
      color: colorScheme.surface,
      elevation: 0,
      shadowColor: const Color(0x1F2B264F),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
      ),
    ),
    dividerColor: const Color(0xFFE1DEF0),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: Color(0xFFE7E5FF),
      labelTextStyle: WidgetStatePropertyAll(
        TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
      ),
    ),
  );
}
