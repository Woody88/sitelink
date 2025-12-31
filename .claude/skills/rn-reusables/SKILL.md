# React Native Reusables Skill
Use this when implementing UI components from reactnativereusables.com.
- **Pattern**: Most components use `lucide-react-native` for icons and `clsx` / `tailwind-merge` for styling.
- **Implementation**: Always check the `components/ui` folder before creating a new component.
- **Consistency**: Use the `cn()` utility function for merging `className` props to ensure Tailwind classes override correctly.