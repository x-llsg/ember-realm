using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using System.Reflection;
[assembly: AssemblyTitle("余烬之境")]
[assembly: AssemblyDescription("余烬之境离线版一键启动")]
[assembly: AssemblyProduct("余烬之境")]
[assembly: AssemblyVersion("0.3.2.0")]
internal static class Launcher {
 [STAThread] private static void Main() {
  string target=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"ember-realm","play.html");
  if(!File.Exists(target)){MessageBox.Show("没有找到游戏文件。请将本程序与 ember-realm 文件夹放在同一个目录。","余烬之境",MessageBoxButtons.OK,MessageBoxIcon.Information);return;}
  try{Process.Start(new ProcessStartInfo(target){UseShellExecute=true});}
  catch(Exception){MessageBox.Show("无法自动打开浏览器。请进入 ember-realm 文件夹，双击 play.html。","余烬之境",MessageBoxButtons.OK,MessageBoxIcon.Information);}
 }
}
