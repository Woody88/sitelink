# NativeWind Styling Skill
Use this when styling React Native components with Tailwind CSS.
- **Syntax**: Use `className="..."` on standard components.
- **Config**: Use `nativewind/babel` and the `withNativeWind` HOC if required by the version.
- **Best Practice**: Use `twrnc` or the `nativewind` compiler. 
- **Gotchas**: Avoid dynamic string interpolation in `className` that isn't pre-compiled.