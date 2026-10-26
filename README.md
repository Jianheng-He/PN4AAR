# PN4AAR · 面向无人机自主对接的三维比例导引实验

用可旋转的三维场景，直观比较不同 PN 导引律在**同一相对运动状态**下给出的加速度指令与轨迹。

**[打开在线网页 →](https://pn4aar.luckygnome9.chatgpt.site)**

## 可以做什么

- 切换 RTPN、TPN、PPN、IPN、APN、AIPN、BPN、BPPN、GTPN 和 ZEM-PN，共 10 个选项。
- 编辑三轴相对位置、相对速度、本机地速、目标加速度及偏置。
- 旋转、缩放三维场景，叠加基础导引律，比较指令方向和数值。
- 查看每个选项的具体公式、所需输入、适用边界和原始文献。
- 对所选 PN 做三维闭环轨迹积分，播放、暂停、拖动时间，查看最近间距与末相对速率。

注：轨迹采用理想质点模型，不实现位置 PID、姿态环或舵面控制。

## 文件说明

| 文件                       | 作用                                        |
| -------------------------- | ------------------------------------------- |
| `index.html` / `style.css` | 页面结构与样式                              |
| `app.mjs`                  | 输入、界面更新和结果对比                    |
| `guidance.mjs`             | 向量运算、导引公式、预设与文献链接          |
| `simulation.mjs`           | 闭环 RK4 积分、加速度限幅与停止事件         |
| `scene.mjs`                | 三维模型、向量、惯性坐标轨迹绘制            |
| `test.mjs`                 | 不依赖浏览器的数学检查                      |
| `vendor/`                  | Three.js 0.180.0、OrbitControls 及 MIT 许可 |
| `preview.jpg`              | README 页面预览                             |

修改公式看 `guidance.mjs`，修改积分模型看 `simulation.mjs`，修改三维绘图看 `scene.mjs`。保存后刷新浏览器即可。

## 怎么看轨迹

1. 选择导引律和预设；需要时展开“编辑三轴输入”。这里输入的是初始状态。
2. 点击“计算轨迹”。浅色线是整个计算结果，实色线是已播放部分，蓝色为无人机、橙色为锥套。
3. 点击“播放”，或拖动时间轴；可切换透视、俯视、侧视。“看当前”放大当前相对几何，“居中”显示完整轨迹。
4. 展开“积分参数与模型”调整时长、最大步长、接近阈值和可选加速度限幅；限幅为 0 时关闭。

## 公式约定

所有物理向量在右手北东地系 NED 中计算，单位为 m、s、rad。定义：

```text
r  = pT − pU                 相对位置：目标减本机
vr = vT − vU                 相对地速：目标减本机
R  = |r|，er = r / R         距离、视线单位向量
ω  = (r × vr) / R²           视线角速度向量
Vc = −er · vr                带符号闭合速度
Pr = I − er erᵀ              视线法平面投影
PU = I − ûU ûUᵀ              本机地速法平面投影
et = Pr vr / |Pr vr|         视线法平面内的相对速度方向
```

| 选项   | 本项目采用的加速度指令                                                |
| ------ | --------------------------------------------------------------------- |
| RTPN   | `N Vc (ω × er)`，使用实时闭合速度                                     |
| TPN    | `N Vc₀ (ω × er)`，使用固定初始闭合速度                                |
| PPN    | `N (ω × vU)`                                                          |
| IPN    | `N (vr × ω)`                                                          |
| APN    | `RTPN + (N/2) Pr aT`，经典横向近似的三维投影实现                      |
| AIPN   | `IPN + aT`，选用完整目标加速度补偿版本                                |
| BPN    | `RTPN + Pr b`，选用显式投影偏置示例                                   |
| BPPN   | `PPN + PU b`，选用速度法向偏置示例                                    |
| GTPN   | `N Vc norm(ω) (cosβ et + sinβ er)`，选用局部平面推广；`norm` 表示模长 |
| ZEM-PN | `(N/tgo²) Pr (r + vr tgo)`，`tgo = R/Vc > 0`                          |

PN 的命名并不完全统一；部分文献把这里的 RTPN 也称为 TPN。APN、BPN 等有多个版本，以上列出本项目实际实现的形式，不声称穷尽所有 PN。GTPN 在 `ω = 0` 时定义为零指令。ZEM-PN 在本页约定下与 RTPN 等价。

## 检查公式与积分（可选）

安装 Node.js 18 或更新版本后，运行：

```sh
node test.mjs
```

成功会输出 `"passed":true`。测试使用固定随机种子，检查数值例、正交性、公式恒等关系、200 组状态的三维旋转协变性，以及零距离、零速度和负闭合速度等边界；另检查径向接近的解析到达时间、速度不变量、AIPN 恒加速度补偿、限幅及事件停止，共 22,285 项断言。它验证公式和理想质点积分，不验证真实飞行性能。

## 文献与第三方代码

公式依据和逐项链接保存在 `guidance.mjs`，网页底部也可直接打开。主要参考：

- [Palumbo 等：Basic Principles of Homing Guidance](https://secwww.jhuapl.edu/techdigest/content/techdigest/pdf/V29-N01/29-01-Palumbo_Principles_Rev2018.pdf)
- [Shukla 与 Mahapatra：The Proportional Navigation Dilemma—Pure or True?](https://doi.org/10.1109/7.53445)
- [Li 等：Ideal Proportional Navigation for Exoatmospheric Interception](https://doi.org/10.1016/j.cja.2013.06.007)
- [Ghose：NPTEL Guidance of Missiles，Lecture 38](https://archive.nptel.ac.in/content/storage2/courses/101108054/module12/lecture38.pdf)

Three.js 与 OrbitControls 的第三方许可证见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。该许可证适用于相应第三方代码。
