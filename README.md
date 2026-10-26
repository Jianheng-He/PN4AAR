# 3D-PN4AAR · 三维比例导引实验室

用可旋转的三维场景，直观比较不同 PN 导引律在**同一相对运动状态**下给出的加速度指令。场景包含无人机、锥套目标、北东地坐标轴、视线和速度向量。

**[打开在线网页 →](https://pn-3d-docking-lab.luckygnome9.chatgpt.site)**

网页已独立托管。本仓库用于项目介绍和源码展示，不需要配置 GitHub Pages。

![3D-PN4AAR 页面预览](preview.png)

## 可以做什么

- 切换 RTPN、TPN、PPN、IPN、APN、AIPN、BPN、BPPN、GTPN 和 ZEM-PN，共 10 个选项。
- 编辑三轴相对位置、相对速度、本机地速、目标加速度及偏置。
- 旋转、缩放三维场景，叠加基础导引律，比较指令方向和数值。
- 查看每个选项的具体公式、所需输入、适用边界和原始文献。

这是瞬时几何与公式演示，不进行轨迹积分，也不实现无人机位置 PID 或舵面控制。

## 本地运行

安装 Python 3 后，在本项目文件夹打开终端，运行：

```sh
python -m http.server 8000
```

浏览器打开 [localhost:8000](http://localhost:8000)。结束时按 `Ctrl+C`。Windows 如果找不到 `python`，可用 `py -m http.server 8000`。

无需 npm、安装依赖或构建。Three.js 已放在 `vendor/`，浏览网页不依赖 CDN。请通过上述 HTTP 服务打开，直接双击 `index.html` 可能被浏览器的模块安全策略阻止。

## 检查公式（可选）

安装 Node.js 18 或更新版本后，运行：

```sh
node test.mjs
```

成功会输出 `"passed":true`。测试使用固定随机种子，检查数值例、正交性、公式恒等关系、200 组状态的三维旋转协变性，以及零距离、零速度和负闭合速度等边界；共 22,235 项断言。它验证实现与本项目声明的公式一致，不验证飞行闭环性能。

## 文件说明

| 文件                       | 作用                                        |
| -------------------------- | ------------------------------------------- |
| `index.html` / `style.css` | 页面结构与样式                              |
| `app.mjs`                  | 输入、界面更新和结果对比                    |
| `guidance.mjs`             | 向量运算、导引公式、预设与文献链接          |
| `scene.mjs`                | 三维无人机、锥套、坐标轴和向量绘制          |
| `test.mjs`                 | 不依赖浏览器的数学检查                      |
| `vendor/`                  | Three.js 0.180.0、OrbitControls 及 MIT 许可 |
| `preview.png`              | README 页面预览                             |

修改公式主要看 `guidance.mjs`；修改三维场景主要看 `scene.mjs`。保存后刷新浏览器即可。

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

| 选项 | 本项目采用的加速度指令 |
| --- | --- |
| RTPN | `N Vc (ω × er)`，使用实时闭合速度 |
| TPN | `N Vc₀ (ω × er)`，使用固定初始闭合速度 |
| PPN | `N (ω × vU)` |
| IPN | `N (vr × ω)` |
| APN | `RTPN + (N/2) Pr aT`，经典横向近似的三维投影实现 |
| AIPN | `IPN + aT`，选用完整目标加速度补偿版本 |
| BPN | `RTPN + Pr b`，选用显式投影偏置示例 |
| BPPN | `PPN + PU b`，选用速度法向偏置示例 |
| GTPN | `N Vc norm(ω) (cosβ et + sinβ er)`，选用局部平面推广；`norm` 表示模长 |
| ZEM-PN | `(N/tgo²) Pr (r + vr tgo)`，`tgo = R/Vc > 0` |

PN 的命名并不完全统一；部分文献把这里的 RTPN 也称为 TPN。APN、BPN 等有多个版本，以上列出本项目实际实现的形式，不声称穷尽所有 PN。GTPN 在 `ω = 0` 时定义为零指令。ZEM-PN 在本页约定下与 RTPN 等价。

视线只有一个，各方法改变的是加速度指令的方向与尺度。PPN 的指令垂直于本机地速，IPN 的指令垂直于相对速度，TPN/RTPN 的指令垂直于视线。相同 N 下：

```text
aIPN − aRTPN = N |Pr vr|² er / R
```

因此 IPN 与 RTPN 的差异包含径向加速度，不能简单看成重命名参考方向，也不能仅据此判定哪一个性能更好。IPN 保持相对速率的结论要求目标匀速且加速度理想执行。

目标加速度 `aT` 是可编辑的已知示例输入，不表示视觉测量能可靠得到它。相对位置和速度必须来自同一参考点、时刻与坐标系。模型姿态、锥套朝向和尺寸仅用于示意；这里没有末速度、末角或对接成功保证。NED 到绘图坐标的转换为 `[E, −D, −N]`，保持右手性。

## 文献与第三方代码

公式依据和逐项链接保存在 `guidance.mjs`，网页底部也可直接打开。主要参考：

- [Palumbo 等：Basic Principles of Homing Guidance](https://secwww.jhuapl.edu/techdigest/content/techdigest/pdf/V29-N01/29-01-Palumbo_Principles_Rev2018.pdf)
- [Shukla 与 Mahapatra：The Proportional Navigation Dilemma—Pure or True?](https://doi.org/10.1109/7.53445)
- [Li 等：Ideal Proportional Navigation for Exoatmospheric Interception](https://doi.org/10.1016/j.cja.2013.06.007)
- [Ghose：NPTEL Guidance of Missiles，Lecture 38](https://archive.nptel.ac.in/content/storage2/courses/101108054/module12/lecture38.pdf)

Three.js 与 OrbitControls 的第三方许可证见 [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt)。该许可证适用于相应第三方代码。
